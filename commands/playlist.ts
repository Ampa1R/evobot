import { DiscordGatewayAdapterCreator, joinVoiceChannel } from "@discordjs/voice";
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";
import { bot } from "../index";
import { MusicQueue } from "../structs/MusicQueue";
import { Playlist, PlaylistPreset } from "../structs/Playlist";
import { Song } from "../structs/Song";
import { i18n } from "../utils/i18n";
import { Logger } from "../utils/logger";

enum PlaylistCommandOption {
  Search = 'search',
  Preset = 'preset',
}

export default {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription(i18n.__("playlist.description"))
    .addStringOption((option) => option.setName(PlaylistCommandOption.Search).setDescription("Playlist name or link"))
    .addStringOption((option) =>
      option
        .setName(PlaylistCommandOption.Preset)
        .setDescription("choose one of well-known playlist")
        .addChoices({ name: "mashup", value: PlaylistPreset.Mashup }, { name: "DOTA Night", value: PlaylistPreset.DotaNight }, { name: "Rap", value: PlaylistPreset.Rap })
    ),
  cooldown: 5,
  permissions: [
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
    PermissionsBitField.Flags.AddReactions,
    PermissionsBitField.Flags.ManageMessages
  ],
  async execute(interaction: ChatInputCommandInteraction) {
    const playlistPresetName = interaction.options.getString(PlaylistCommandOption.Preset);
    let argSongName = interaction.options.getString(PlaylistCommandOption.Search);

    if (playlistPresetName && Object.values<string>(PlaylistPreset).includes(playlistPresetName)) {
      argSongName = Playlist.getUrlFor(playlistPresetName as PlaylistPreset);
    }

    const guildMemer = interaction.guild!.members.cache.get(interaction.user.id);
    const { channel } = guildMemer!.voice;

    const queue = bot.queues.get(interaction.guild!.id);

    if (!channel)
      return interaction.reply({ content: i18n.__("playlist.errorNotChannel"), ephemeral: true }).catch(Logger.error);

    if (queue && channel.id !== queue.connection.joinConfig.channelId)
      if (interaction.replied)
        return interaction
          .editReply({ content: i18n.__mf("play.errorNotInSameChannel", { user: interaction.client.user!.username }) })
          .catch(Logger.error);
      else
        return interaction
          .reply({
            content: i18n.__mf("play.errorNotInSameChannel", { user: interaction.client.user!.username }),
            ephemeral: true
          })
          .catch(Logger.error);

    let playlist;

    try {
      playlist = await Playlist.from(argSongName!.split(" ")[0], argSongName!);
    } catch (error) {
      Logger.error(error);

      if (interaction.replied)
        return interaction.editReply({ content: i18n.__("playlist.errorNotFoundPlaylist") }).catch(Logger.error);
      else
        return interaction
          .reply({ content: i18n.__("playlist.errorNotFoundPlaylist"), ephemeral: true })
          .catch(Logger.error);
    }

    if (queue) {
      queue.songs.push(...playlist.videos);
    } else {
      const newQueue = new MusicQueue({
        interaction,
        textChannel: interaction.channel! as TextChannel,
        connection: joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
        })
      });

      bot.queues.set(interaction.guild!.id, newQueue);

      newQueue.enqueue(...playlist.videos);
    }

    let playlistEmbed = new EmbedBuilder()
      .setTitle(`${playlist.data.title}`)
      .setDescription(
        playlist.videos
          .map((song: Song, index: number) => `${index + 1}. ${song.title}`)
          .join("\n")
          .slice(0, 4095)
      )
      .setURL(playlist.data.url!)
      .setColor("#F8AA2A")
      .setTimestamp();

    if (interaction.replied)
      return interaction.editReply({
        content: i18n.__mf("playlist.startedPlaylist", { author: interaction.user.id }),
        embeds: [playlistEmbed]
      });
    interaction
      .reply({
        content: i18n.__mf("playlist.startedPlaylist", { author: interaction.user.id }),
        embeds: [playlistEmbed]
      })
      .catch(Logger.error);
  }
};
