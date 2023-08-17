import {
  AudioPlayer,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  entersState,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionState,
  VoiceConnectionStatus
} from "@discordjs/voice";
import { CommandInteraction, Message, TextChannel, User, VoiceChannel } from "discord.js";
import { promisify } from "node:util";
import { bot } from "../index";
import { QueueOptions } from "../interfaces/QueueOptions";
import { config } from "../utils/config";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { Song } from "./Song";
import { Logger } from "../utils/logger";

const wait = promisify(setTimeout);

export class MusicQueue {
  private readonly logger = new Logger(this.constructor.name);
  public readonly interaction: CommandInteraction;
  public readonly connection: VoiceConnection;
  public readonly player: AudioPlayer;
  public readonly textChannel: TextChannel;
  public readonly bot = bot;

  public resource: AudioResource;
  public songs: Song[] = [];
  public volume = config.DEFAULT_VOLUME || 100;
  public loop = false;
  public muted = false;
  public waitTimeout: NodeJS.Timeout | null;
  private queueLock = false;
  private readyLock = false;
  private stopped = false;

  public constructor(options: QueueOptions) {
    Object.assign(this, options);

    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    this.connection.subscribe(this.player);

    const networkStateChangeHandler = (oldNetworkState: any, newNetworkState: any) => {
      const newUdp = Reflect.get(newNetworkState, "udp");
      clearInterval(newUdp?.keepAliveInterval);
    };

    this.connection.on("stateChange" as any, async (oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
      Reflect.get(oldState, "networking")?.off("stateChange", networkStateChangeHandler);
      Reflect.get(newState, "networking")?.on("stateChange", networkStateChangeHandler);

      if (newState.status === VoiceConnectionStatus.Disconnected) {
        if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
          try {
            this.stop();
          } catch (e) {
            this.logger.log(e);
            this.stop();
          }
        } else if (this.connection.rejoinAttempts < 5) {
          await wait((this.connection.rejoinAttempts + 1) * 5_000);
          this.connection.rejoin();
        } else {
          this.connection.destroy();
        }
      } else if (
        !this.readyLock &&
        (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)
      ) {
        this.readyLock = true;
        try {
          await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
        } catch {
          if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            try {
              this.connection.destroy();
            } catch {}
          }
        } finally {
          this.readyLock = false;
        }
      }
    });

    this.player.on("stateChange" as any, async (oldState: AudioPlayerState, newState: AudioPlayerState) => {
      if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle) {
        if (this.loop && this.songs.length) {
          this.songs.push(this.songs.shift()!);
        } else {
          this.songs.shift();
          if (!this.songs.length) return this.stop();
        }

        if (this.songs.length || this.resource.audioPlayer) this.processQueue();
      } else if (oldState.status === AudioPlayerStatus.Buffering && newState.status === AudioPlayerStatus.Playing) {
        this.sendPlayingMessage(newState);
      }
    });

    this.player.on("error", (error) => {
      this.logger.error(error);

      if (this.loop && this.songs.length) {
        this.songs.push(this.songs.shift()!);
      } else {
        this.songs.shift();
      }

      this.processQueue();
    });
  }

  public enqueue(...songs: Song[]) {
    if (this.waitTimeout !== null) clearTimeout(this.waitTimeout);
    this.waitTimeout = null;
    this.stopped = false;
    this.songs = this.songs.concat(songs);
    this.processQueue();
  }

  public stop() {
    if (this.stopped) return;

    this.stopped = true;
    this.loop = false;
    this.songs = [];
    this.player.stop();

    this.logger.log("Queue ended");
    this.bot.setSong();
    !config.PRUNING && this.textChannel.send(i18n.__("play.queueEnded")).catch(this.logger.error);

    if (this.waitTimeout !== null) return;

    this.waitTimeout = setTimeout(() => {
      if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        try {
          this.connection.destroy();
        } catch {}
      }
      bot.queues.delete(this.interaction.guild!.id);

      !config.PRUNING && this.textChannel.send(i18n.__("play.leaveChannel"));
    }, config.STAY_TIME * 1000);
  }

  public async processQueue(): Promise<void> {
    if (this.queueLock || this.player.state.status !== AudioPlayerStatus.Idle) {
      return;
    }

    if (!this.songs.length) {
      return this.stop();
    }

    this.queueLock = true;

    const next = this.songs[0];

    try {
      const resource = await next.makeResource();

      if (this.connection.joinConfig.channelId) {
        const channel = this.bot.client.channels.cache.get(this.connection.joinConfig.channelId);
        if (channel instanceof VoiceChannel && channel.members.size < 2) {
          this.logger.log(`Stop playing in channel ${channel.name} since it has less than 2 active members`);
          return this.stop();
        }
      }

      this.resource = resource!;
      this.player.play(this.resource);
      this.resource.volume?.setVolumeLogarithmic(this.volume / 100);
      this.queueLock = false;
    } catch (error: any) {
      this.logger.error(error.name, error);
      this.songs.shift();
      this.queueLock = false;

      return this.processQueue();
    }
  }

  private async sendPlayingMessage(newState: any) {
    const song = (newState.resource as AudioResource<Song>).metadata;

    let playingMessage: Message;

    try {
      playingMessage = await this.textChannel.send(song.startMessage());
      this.bot.setSong(song);

      await playingMessage.react("⏭");
      await playingMessage.react("⏯");
      await playingMessage.react("🔇");
      await playingMessage.react("🔉");
      await playingMessage.react("🔊");
      await playingMessage.react("🔁");
      await playingMessage.react("🔀");
      await playingMessage.react("⏹");
    } catch (error: any) {
      this.logger.error(error);
      this.textChannel.send(error.message);
      return;
    }

    const filter = (reaction: any, user: User) => user.id !== this.textChannel.client.user!.id;

    const collector = playingMessage.createReactionCollector({
      filter,
      time: song.duration > 0 ? song.duration * 1000 : 600000
    });

    collector.on("collect", async (reaction, user) => {
      if (!this.songs) return;

      const member = await playingMessage.guild!.members.fetch(user);
      Object.defineProperty(this.interaction, "user", {
        value: user
      });

      switch (reaction.emoji.name) {
        case "⏭":
          reaction.users.remove(user).catch(this.logger.error);
          await this.bot.slashCommandsMap.get("skip")!.execute(this.interaction);
          break;

        case "⏯":
          reaction.users.remove(user).catch(this.logger.error);
          if (this.player.state.status == AudioPlayerStatus.Playing) {
            await this.bot.slashCommandsMap.get("pause")!.execute(this.interaction);
          } else {
            await this.bot.slashCommandsMap.get("resume")!.execute(this.interaction);
          }
          break;

        case "🔇":
          reaction.users.remove(user).catch(this.logger.error);
          if (!canModifyQueue(member)) return i18n.__("common.errorNotChannel");
          this.muted = !this.muted;
          if (this.muted) {
            this.resource.volume?.setVolumeLogarithmic(0);
            this.textChannel.send(i18n.__mf("play.mutedSong", { author: user })).catch(this.logger.error);
          } else {
            this.resource.volume?.setVolumeLogarithmic(this.volume / 100);
            this.textChannel.send(i18n.__mf("play.unmutedSong", { author: user })).catch(this.logger.error);
          }
          break;

        case "🔉":
          reaction.users.remove(user).catch(this.logger.error);
          if (this.volume == 0) return;
          if (!canModifyQueue(member)) return i18n.__("common.errorNotChannel");
          this.volume = Math.max(this.volume - 10, 0);
          this.resource.volume?.setVolumeLogarithmic(this.volume / 100);
          this.textChannel
            .send(i18n.__mf("play.decreasedVolume", { author: user, volume: this.volume }))
            .catch(this.logger.error);
          break;

        case "🔊":
          reaction.users.remove(user).catch(this.logger.error);
          if (this.volume == 100) return;
          if (!canModifyQueue(member)) return i18n.__("common.errorNotChannel");
          this.volume = Math.min(this.volume + 10, 100);
          this.resource.volume?.setVolumeLogarithmic(this.volume / 100);
          this.textChannel
            .send(i18n.__mf("play.increasedVolume", { author: user, volume: this.volume }))
            .catch(this.logger.error);
          break;

        case "🔁":
          reaction.users.remove(user).catch(this.logger.error);
          await this.bot.slashCommandsMap.get("loop")!.execute(this.interaction);
          break;

        case "🔀":
          reaction.users.remove(user).catch(this.logger.error);
          await this.bot.slashCommandsMap.get("shuffle")!.execute(this.interaction);
          break;

        case "⏹":
          reaction.users.remove(user).catch(this.logger.error);
          await this.bot.slashCommandsMap.get("stop")!.execute(this.interaction);
          collector.stop();
          break;

        default:
          reaction.users.remove(user).catch(this.logger.error);
          break;
      }
    });

    collector.on("end", () => {
      playingMessage.reactions.removeAll().catch(this.logger.error);

      if (config.PRUNING) {
        setTimeout(() => {
          playingMessage.delete().catch();
        }, 3000);
      }
    });
  }
}
