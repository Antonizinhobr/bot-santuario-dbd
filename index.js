require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');

if (!process.env.TOKEN || !process.env.CLIENT_ID) {
    console.error('❌ Erro: Variáveis de ambiente não configuradas corretamente!');
    console.error('Certifique-se de ter um arquivo .env com: TOKEN e CLIENT_ID');
    process.exit(1);
}

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const DB_PATH = './canais.json';

function lerCanais() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function salvarCanal(guildId, channelId) {
    const data = lerCanais();
    data[guildId] = channelId;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4));
}

process.on('unhandledRejection', (error) => console.error('❌ Promessa rejeitada não tratada:', error));
process.on('uncaughtException', (error) => console.error('❌ Exceção não capturada:', error));

setInterval(() => {
    console.log('💓 Heartbeat enviado em', new Date().toISOString());
}, 5 * 60 * 1000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

async function buscarSantuarioEmbeds() {
    try {
        const response = await fetch('https://api.nightlight.gg/v1/shrine');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const dados = await response.json();

        if (!dados || !dados.data || !dados.data.perks) throw new Error('Dados da API em formato inválido');

        // --- NOVA LÓGICA DO CONTADOR PARA 3 DIAS ---
        const agora = new Date();
        const proximoReset = new Date();
        
        // Configura para as 15:00 UTC de hoje
        proximoReset.setUTCHours(15, 0, 0, 0);

        // Se já passou das 15:00 UTC hoje, o próximo reset é em 3 dias
        if (agora.getUTCHours() >= 15) {
            proximoReset.setUTCDate(proximoReset.getUTCDate() + 3);
        }

        const timestampUnix = Math.floor(proximoReset.getTime() / 1000);
        // -------------------------------------

        const mainEmbed = new EmbedBuilder()
            .setTitle('💠 Santuário dos Segredos - Dead by Daylight')
            .setColor('#8a2be2')
            .setDescription(`Confira as vantagens disponíveis nesta rotação!\n\n⏳ **Próxima rotação:** <t:${timestampUnix}:R>\n📅 **Data:** <t:${timestampUnix}:F>`)
            .setThumbnail('https://nightlight.gg/images/shrine/shrine.png')
            .setFooter({ text: 'Atualização Automática via Nightlight.gg' })
            .setTimestamp();

        const listaDeEmbeds = [mainEmbed];

        if (dados.data.perks.length > 0) {
            dados.data.perks.forEach(perk => {
                const nomePerk = perk.name || 'Desconhecido';
                const dono = perk.character || 'Vantagem Universal';
                const custo = perk.shards || 'N/A';
                const uso = perk.usage_tier ? perk.usage_tier.toUpperCase() : 'N/A';
                const urlImagem = perk.image ? `https://cdn.nightlight.gg/img/${perk.image}` : 'https://nightlight.gg/images/shrine/shrine.png';

                const perkEmbed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setAuthor({ name: dono, iconURL: urlImagem })
                    .setTitle(`✨ ${nomePerk}`)
                    .setThumbnail(urlImagem)
                    .addFields(
                        { name: '💎 Custo', value: `\`${custo}\` Fragmentos`, inline: true },
                        { name: '📈 Taxa de Uso', value: `\`${uso}\``, inline: true }
                    );
                
                listaDeEmbeds.push(perkEmbed);
            });
        } else {
            mainEmbed.addFields({ name: '⚠️ Aviso', value: 'Nenhuma vantagem encontrada na rotação atual.' });
        }
        
        return listaDeEmbeds;
    } catch (error) {
        console.error('❌ Erro ao buscar API:', error.message);
        return null;
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName('shrine')
        .setDescription('Mostra o santuário atual do DBD com imagens e contador'),
    new SlashCommandBuilder()
        .setName('setcanal')
        .setDescription('Define o canal onde o bot enviará as atualizações automáticas')
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('Canal de texto para os anúncios do santuário')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Registrando comandos slash...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos registrados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
})();

client.once('ready', async () => {
    console.log(`🤖 Bot online! Logado como ${client.user.tag}`);

    // --- MUDANÇA NO CRON PARA RODAR A CADA 3 DIAS ---
    cron.schedule('5 12 */3 * *', async () => {
        console.log('🔄 Atualização automática do Santuário iniciada (Múltiplos Servidores)...');
        try {
            const embeds = await buscarSantuarioEmbeds();
            if (!embeds || embeds.length === 0) {
                console.error('❌ Falha ao obter embeds para envio automático');
                return;
            }

            const canaisConfigurados = lerCanais();

            for (const [guildId, channelId] of Object.entries(canaisConfigurados)) {
                try {
                    const canal = await client.channels.fetch(channelId);
                    if (canal && canal.isTextBased()) {
                        await canal.send({ content: '🔔 **O Santuário atualizou!**', embeds: embeds });
                        console.log(`✅ Santuário enviado para o servidor ${guildId}`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao enviar para o canal ${channelId} no servidor ${guildId}:`, error.message);
                }
            }
        } catch (error) {
            console.error('❌ Erro na execução automática:', error);
        }
    }, {
        timezone: "America/Sao_Paulo"
    });
    
    // --- TEXTO DE LOG ATUALIZADO ---
    console.log('⏰ Agendamento configurado: A cada 3 dias às 12:05 (BRT)');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setcanal') {
        const canal = interaction.options.getChannel('canal');
        
        salvarCanal(interaction.guildId, canal.id);
        return interaction.reply({ content: `✅ Canal de atualizações configurado com sucesso para <#${canal.id}>! O bot enviará o Santuário a cada 3 dias aqui.` });
    }

    if (interaction.commandName === 'shrine') {
        await interaction.deferReply();

        try {
            const embeds = await buscarSantuarioEmbeds();
            if (embeds && embeds.length > 0) {
                await interaction.editReply({ embeds: embeds });
                console.log(`✅ Comando /shrine executado por ${interaction.user.tag} no servidor ${interaction.guildId}`);
            } else {
                await interaction.editReply('❌ Erro ao buscar o Santuário. Tente novamente mais tarde.');
            }
        } catch (error) {
            console.error('❌ Erro no comando /shrine:', error);
            await interaction.editReply('❌ Ocorreu um erro ao processar sua solicitação.');
        }
    }
});

client.on('error', (error) => console.error('❌ Erro no cliente Discord:', error));
client.on('disconnect', () => console.log('⚠️ Bot desconectado. Tentando reconectar...'));

console.log('⏳ Conectando à Entidade...');
client.login(TOKEN).catch(error => {
    console.error('❌ Erro ao fazer login:', error);
    process.exit(1);
});