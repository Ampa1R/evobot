import { ChatInputCommandInteraction, InteractionReplyOptions, SlashCommandBuilder } from "discord.js";
import { bot } from "../index";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { Logger } from "../utils/logger";
import { generateQueueEmbed } from "./queue";

export default {
  data: new SlashCommandBuilder().setName("shuffle").setDescription(i18n.__("shuffle.description")),
  execute(interaction: ChatInputCommandInteraction) {
    const queue = bot.queues.get(interaction.guild!.id);
    const guildMemer = interaction.guild!.members.cache.get(interaction.user.id);

    if (!queue)
      return interaction.reply({ content: i18n.__("shuffle.errorNotQueue"), ephemeral: true }).catch(Logger.error);

    if (!guildMemer || !canModifyQueue(guildMemer)) return i18n.__("common.errorNotChannel");

    let songs = queue.songs;

    for (let i = songs.length - 1; i > 1; i--) {
      let j = 1 + Math.floor(Math.random() * i);
      [songs[i], songs[j]] = [songs[j], songs[i]];
    }

    queue.songs = songs;

    // FIXME: generates pages for the whole queue, we need only first page
    const queueEmbed = generateQueueEmbed(interaction, queue.songs);

    const content: InteractionReplyOptions = {
      content: i18n.__mf("shuffle.result", { author: interaction.user.id }),
      embeds: [queueEmbed[0]],
    };

    if (interaction.replied) interaction.followUp(content).catch(Logger.error);
    else interaction.reply(content).catch(Logger.error);
  }
};
