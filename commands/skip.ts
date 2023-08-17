import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { bot } from "../index";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { Logger } from "../utils/logger";

export default {
  data: new SlashCommandBuilder().setName("skip").setDescription(i18n.__("skip.description")),
  execute(interaction: ChatInputCommandInteraction) {
    const queue = bot.queues.get(interaction.guild!.id);
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!queue) {
      return interaction.reply(i18n.__("skip.errorNotQueue")).catch(Logger.error);
    }

    if (!canModifyQueue(guildMember!)) {
      return interaction.reply(i18n.__("common.errorNotChannel")).catch(Logger.error);
    }

    queue.player.stop(true);

    interaction.reply({ content: i18n.__mf("skip.result", { author: interaction.user.id }) }).catch(Logger.error);
  }
};
