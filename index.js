const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    InteractionType,
    StringSelectMenuOptionBuilder,
} = require("discord.js");

const { Client: SelfBot } = require("discord.js-selfbot-v13");
const db = require("pro.db");
const config = require("./config.json");

const mainBot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
});

const prefix = config.prefix;

function runSelf(token, guildId, channels, accountId) {
    const self = new SelfBot({ checkUpdate: false });

    self.on("ready", async () => {
        console.log(`✅ تسجيل دخول: ${self.user.tag}`);
        let accounts = (await db.get("accounts")) || [];
        let account = accounts.find((acc) => acc.id === accountId);

        if (account) {
            account.displayName = self.user.username;
            await db.set("accounts", accounts);
        }
    });

    self.on("messageReactionAdd", async (reaction, user) => {
        try {
            if (
                reaction.message.guild.id === guildId &&
                channels.includes(reaction.message.channel.id) &&
                !user.bot
            ) {
                await reaction.message.react(reaction.emoji.identifier);
            }
        } catch (err) {
            console.error(`❌ خطأ عند اضافة الرياكشن: ${err.message}`);
        }
    });

    self.login(token).catch((err) => {
        console.error(`❌ فشل تسجيل دخول حساب: ${err.message}`);
    });
}

mainBot.once("ready", async () => {
    console.log(`🚀 البوت يعمل: ${mainBot.user.tag}`);
    const accounts = (await db.get("accounts")) || [];
    accounts.forEach((acc) => {
        runSelf(acc.token, acc.guild, acc.channels || [], acc.id);
    });
});

mainBot.on("messageCreate", async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (command === "panel") {
        const embed = new EmbedBuilder()
            .setTitle("🛠️ لوحة التحكم في الحسابات")
            .setDescription(
                "اختر أحد الخيارات أدناه للتحكم في التوكنات والحسابات",
            )
            .setColor("Blue");

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("add_token")
                .setLabel("➕ إضافة توكن")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("list_tokens")
                .setLabel("📜 قائمة الحسابات")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("delete_token")
                .setLabel("🗑️ حذف حساب")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("delete_all")
                .setLabel("❌ حذف جميع الحسابات")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("control_token")
                .setLabel("⚙️ التحكم في الحساب")
                .setStyle(ButtonStyle.Primary),
        );

        return message.channel.send({ embeds: [embed], components: [buttons] });
    }
});

mainBot.on("interactionCreate", async (interaction) => {
    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === "modal_add_token") {
            const token = interaction.fields.getTextInputValue("field_token");
            const guildId = interaction.fields.getTextInputValue("field_guild");
            const channelId =
                interaction.fields.getTextInputValue("field_channel");

            let accounts = (await db.get("accounts")) || [];

            if (accounts.find((acc) => acc.token === token)) {
                return interaction.reply({
                    content: "⚠️ هذا التوكن مضاف مسبقًا.",
                    ephemeral: true,
                });
            }

            const accountId = Date.now().toString();
            accounts.push({
                id: accountId,
                token,
                guild: guildId,
                channels: [channelId],
                displayName: "جارِ التحميل...",
            });
            await db.set("accounts", accounts);

            runSelf(token, guildId, [channelId], accountId);

            return interaction.reply({
                content: "✅ تم إضافة الحساب وتشغيله بنجاح!",
                ephemeral: true,
            });
        }

        if (interaction.customId.startsWith("modal_add_server_")) {
            const accountId = interaction.customId.split("_").pop();
            const guildId = interaction.fields.getTextInputValue("field_guild");
            const channelId =
                interaction.fields.getTextInputValue("field_channel");

            let accounts = (await db.get("accounts")) || [];
            let account = accounts.find((a) => a.id === accountId);

            if (!account)
                return interaction.reply({
                    content: "❌ الحساب غير موجود.",
                    ephemeral: true,
                });

            account.guild = guildId;
            account.channels = [channelId];
            await db.set("accounts", accounts);

            return interaction.reply({
                content: "✅ تم إضافة السيرفر والروم بنجاح!",
                ephemeral: true,
            });
        }

        if (interaction.customId.startsWith("modal_add_channel_")) {
            const accountId = interaction.customId.split("_").pop();
            const channelId =
                interaction.fields.getTextInputValue("field_channel");

            let accounts = (await db.get("accounts")) || [];
            let account = accounts.find((a) => a.id === accountId);

            if (!account)
                return interaction.reply({
                    content: "❌ الحساب غير موجود.",
                    ephemeral: true,
                });

            if (!Array.isArray(account.channels)) account.channels = [];

            if (!account.channels.includes(channelId)) {
                account.channels.push(channelId);
                await db.set("accounts", accounts);
                return interaction.reply({
                    content: "✅ تم إضافة الشات بنجاح!",
                    ephemeral: true,
                });
            } else {
                return interaction.reply({
                    content: "⚠️ هذا الشات مضاف مسبقًا.",
                    ephemeral: true,
                });
            }
        }
    }

    if (interaction.isButton()) {
        const id = interaction.customId;

        if (id === "add_token") {
            const modal = new ModalBuilder()
                .setCustomId("modal_add_token")
                .setTitle("إضافة حساب جديد")
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("field_token")
                            .setLabel("التوكن")
                            .setPlaceholder("ضع التوكن هنا")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true),
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("field_guild")
                            .setLabel("ايدي السيرفر")
                            .setPlaceholder("مثال: 123456789012345678")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true),
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("field_channel")
                            .setLabel("ايدي الشات")
                            .setPlaceholder("مثال: 123456789012345678")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true),
                    ),
                );
            return interaction.showModal(modal);
        }

        if (id === "list_tokens") {
            const accounts = (await db.get("accounts")) || [];
            if (accounts.length === 0)
                return interaction.reply({
                    content: "📭 لا يوجد حسابات مضافة.",
                    ephemeral: true,
                });

            const menus = [];
            let chunk = [];

            accounts.forEach((acc, i) => {
                chunk.push({
                    label: acc.displayName || `حساب ${i + 1}`,
                    value: acc.id,
                });

                if (chunk.length === 25 || i === accounts.length - 1) {
                    menus.push(
                        new StringSelectMenuBuilder()
                            .setCustomId(`view_accounts_${menus.length + 1}`)
                            .setPlaceholder("اختر حسابًا")
                            .addOptions(chunk),
                    );
                    chunk = [];
                }
            });

            const components = menus.map((menu) =>
                new ActionRowBuilder().addComponents(menu),
            );
            return interaction.reply({
                content: "📜 اختر حساب لعرض تفاصيله:",
                components,
                ephemeral: true,
            });
        }

        if (id === "delete_all") {
            await db.set("accounts", []);
            return interaction.reply({
                content: "❌ تم حذف جميع الحسابات.",
                ephemeral: true,
            });
        }

        if (id === "delete_token") {
            const accounts = (await db.get("accounts")) || [];
            if (accounts.length === 0)
                return interaction.reply({
                    content: "📭 لا يوجد حسابات لحذفها.",
                    ephemeral: true,
                });

            const select = new StringSelectMenuBuilder()
                .setCustomId("remove_selected_accounts")
                .setPlaceholder("اختر الحسابات المراد حذفها")
                .setMinValues(1)
                .setMaxValues(accounts.length)
                .addOptions(
                    accounts.map((acc) => ({
                        label: acc.displayName || `حساب`,
                        value: acc.id,
                    })),
                );

            return interaction.reply({
                content: "🗑️ اختر الحسابات التي تريد حذفها:",
                components: [new ActionRowBuilder().addComponents(select)],
                ephemeral: true,
            });
        }

        if (id === "control_token") {
            const accounts = (await db.get("accounts")) || [];
            if (accounts.length === 0)
                return interaction.reply({
                    content: "📭 لا يوجد حسابات للتحكم بها.",
                    ephemeral: true,
                });

            const select = new StringSelectMenuBuilder()
                .setCustomId("select_account_control")
                .setPlaceholder("اختر حساب للتحكم به")
                .addOptions(
                    accounts.map((acc) => ({
                        label: acc.displayName || `حساب`,
                        value: acc.id,
                    })),
                );

            return interaction.reply({
                content: "⚙️ اختر الحساب للتحكم:",
                components: [new ActionRowBuilder().addComponents(select)],
                ephemeral: true,
            });
        }
    }

    if (interaction.isStringSelectMenu()) {
        const id = interaction.customId;

        if (id.startsWith("view_accounts_")) {
            const selectedId = interaction.values[0];
            const accounts = (await db.get("accounts")) || [];
            const account = accounts.find((a) => a.id === selectedId);

            if (!account)
                return interaction.reply({
                    content: "❌ لم يتم العثور على الحساب.",
                    ephemeral: true,
                });

            const info = `
**اسم الحساب:** مخفي لحماية الخصوصية
**Guild ID:** ${account.guild}
**Channels:** ${account.channels.join(", ")}
**Token:** ||${account.token}||
    `;

            return interaction.reply({ content: info, ephemeral: true });
        }

        if (id === "remove_selected_accounts") {
            let accounts = (await db.get("accounts")) || [];
            accounts = accounts.filter(
                (acc) => !interaction.values.includes(acc.id),
            );
            await db.set("accounts", accounts);

            return interaction.reply({
                content: "🗑️ تم حذف الحسابات المختارة.",
                ephemeral: true,
            });
        }

        if (id === "select_account_control") {
            const accountId = interaction.values[0];
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`add_server_${accountId}`)
                    .setLabel("➕ إضافة سيرفر")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`add_channel_${accountId}`)
                    .setLabel("➕ إضافة شات")
                    .setStyle(ButtonStyle.Secondary),
            );

            return interaction.reply({
                content: "اختر أحد الخيارات:",
                components: [row],
                ephemeral: true,
            });
        }
    }

    if (interaction.isButton()) {
        const [action, , accountId] = interaction.customId.split("_");

        if (action === "add") {
            if (interaction.customId.startsWith("add_server_")) {
                const modal = new ModalBuilder()
                    .setCustomId(`modal_add_server_${accountId}`)
                    .setTitle("إضافة سيرفر")
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("field_guild")
                                .setLabel("ايدي السيرفر")
                                .setPlaceholder("123456789012345678")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("field_channel")
                                .setLabel("ايدي الشات")
                                .setPlaceholder("123456789012345678")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true),
                        ),
                    );
                return interaction.showModal(modal);
            }

            if (interaction.customId.startsWith("add_channel_")) {
                const modal = new ModalBuilder()
                    .setCustomId(`modal_add_channel_${accountId}`)
                    .setTitle("إضافة شات")
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("field_channel")
                                .setLabel("ايدي الشات")
                                .setPlaceholder("123456789012345678")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true),
                        ),
                    );
                return interaction.showModal(modal);
            }
        }
    }
});

mainBot.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix + "reaction")) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const input = args[1];
    if (!input)
        return message.reply(
            "⚠️ يرجى تحديد رابط الرسالة أو أيدي القناة والرسالة.",
        );

    let channelId, messageId;

    const linkMatch = input.match(
        /https:\/\/discord\.com\/channels\/\d+\/(\d+)\/(\d+)/,
    );
    if (linkMatch) {
        channelId = linkMatch[1];
        messageId = linkMatch[2];
    } else {
        channelId = args[1];
        messageId = args[2];
    }

    if (!channelId || !messageId)
        return message.reply(
            "⚠️ الصيغة غير صحيحة. استخدم:\n" +
                "`reaction <رابط الرسالة>` أو `reaction <channelId> <messageId>`",
        );

    const accounts = (await db.get("accounts")) || [];
    if (accounts.length === 0)
        return message.reply("📭 لا يوجد أي حسابات مضافة.");

    const menu = new StringSelectMenuBuilder()
        .setCustomId("reaction_account_select")
        .setPlaceholder(
            "اختر الحساب الذي سيبحث عن الرسالة (من سيرفر الكميونتي)",
        )
        .addOptions(
            accounts.map((acc) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(acc.displayName || "حساب غير معروف")
                    .setDescription(
                        acc.userId ? `ID: ${acc.userId}` : "بدون ID",
                    )
                    .setValue(acc.token),
            ),
        );

    const row = new ActionRowBuilder().addComponents(menu);
    const msg = await message.reply({
        content: "🔍 اختر الحساب الذي سيبحث عن الرسالة:",
        components: [row],
    });

    const collector = msg.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 60000,
    });

    collector.on("collect", async (interaction) => {
        await interaction.deferUpdate();
        const selectedToken = interaction.values[0];
        const targetAcc = accounts.find((a) => a.token === selectedToken);
        if (!targetAcc) return message.reply("❌ الحساب المحدد غير موجود.");

        await message.channel.send(
            `🔎 جاري تسجيل دخول الحساب **${targetAcc.displayName}** للبحث عن الرسالة...`,
        );

        const searcher = new SelfBot({ checkUpdate: false });
        searcher.on("ready", async () => {
            try {
                const channel = await searcher.channels
                    .fetch(channelId)
                    .catch(() => null);
                if (!channel)
                    throw new Error(
                        "⚠️ الحساب لا يمكنه الوصول إلى القناة المحددة.",
                    );

                const targetMessage = await channel.messages
                    .fetch(messageId)
                    .catch(() => null);
                if (!targetMessage)
                    throw new Error(
                        "❌ لم يتم العثور على الرسالة في القناة المحددة.",
                    );

                const reactions = targetMessage.reactions.cache.map(
                    (r) => r.emoji.identifier,
                );
                if (reactions.length === 0)
                    throw new Error("الرسالة لا تحتوي على أي رياكشنات.");

                await message.channel.send(
                    `✅ تم العثور على الرسالة في السيرفر **${channel.guild?.name || "غير معروف"}**`,
                );

                const results = [];
                await message.channel.send(
                    `⏳ جاري تنفيذ العملية على **${accounts.length}** حساب...`,
                );

                for (const acc of accounts) {
                    const self = new SelfBot({ checkUpdate: false });
                    self.on("ready", async () => {
                        try {
                            const ch = await self.channels.fetch(channelId);
                            const msgFetched =
                                await ch.messages.fetch(messageId);

                            for (const emoji of reactions) {
                                await msgFetched.react(emoji);
                            }

                            results.push({
                                name: self.user.username,
                                status: "✅ نجح",
                            });
                            console.log(
                                `✅ ${self.user.tag} أضاف جميع الرياكشنات.`,
                            );
                        } catch (err) {
                            results.push({
                                name: self.user?.username || "غير معروف",
                                status: "❌ فشل",
                            });
                            console.error(
                                `❌ ${self.user?.tag || "غير معروف"}: ${err.message}`,
                            );
                        }

                        self.destroy();

                        if (results.length === accounts.length) {
                            const embed = new EmbedBuilder()
                                .setTitle("📊 تقرير إضافة الرياكشنات")
                                .setColor("Blue")
                                .setDescription(
                                    results
                                        .map(
                                            (r) =>
                                                `**${r.name}** - ${r.status}`,
                                        )
                                        .join("\n"),
                                )
                                .setFooter({
                                    text: `تم التنفيذ على ${accounts.length} حساب`,
                                })
                                .setTimestamp();

                            message.channel.send({ embeds: [embed] });
                        }
                    });

                    await self.login(acc.token).catch((err) => {
                        results.push({
                            name: acc.displayName || "غير معروف",
                            status: "❌ فشل تسجيل الدخول",
                        });
                        console.error(
                            `❌ فشل تسجيل دخول ${acc.displayName || "غير معروف"}: ${err.message}`,
                        );
                    });
                }
            } catch (err) {
                console.error("❌ خطأ أثناء البحث:", err);
                await message.channel.send(`❌ فشل البحث: ${err.message}`);
            } finally {
                searcher.destroy();
            }
        });

        await searcher.login(selectedToken).catch(async (err) => {
            console.error("❌ فشل تسجيل دخول الحساب المحدد:", err);
            await message.channel.send("❌ فشل تسجيل دخول الحساب المحدد.");
        });
    });

    collector.on("end", () => {
        msg.edit({ components: [] }).catch(() => {});
    });
});

mainBot.login(config.Token);
