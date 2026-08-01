require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionsBitField, 
    ChannelType,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    AttachmentBuilder
} = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const axios = require('axios');
const sharp = require('sharp'); 

if (!process.env.TOKEN || !process.env.CLIENT_ID) {
    console.error('❌ Erro: Variáveis de ambiente não configuradas corretamente!');
    console.error('Certifique-se de ter um arquivo .env com: TOKEN e CLIENT_ID');
    process.exit(1);
}

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Seu ID do Discord configurado para segurança do comando /atualizar
const SEU_DISCORD_ID = '1400218900284571689'; 

const DB_PATH = './canais.json';
const ASSET_BASE_PATH = path.join(__dirname, 'assets', 'shrine_base.png');
const TEMP_IMAGE_PATH = path.join(__dirname, 'assets', 'temp_shrine.png');

const CREDITO_BOT = 'Bot desenvolvido por Anthonny Michael, entre em contato com o comando "/contato".';
const CREDITO_TEXTO = '\n\n*Bot desenvolvido por Anthonny Michael, entre em contato com o comando "/contato".*';
const URL_FOTO_DEV = 'https://avatars.githubusercontent.com/Antonizinhobr';

const POSICOES_EMOJI = ['⬆️', '⬅️', '➡️', '⬇️'];

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

async function gerarImagemSantuario(perks) {
    try {
        console.log('🖼️ Iniciando a composição da imagem...');
        const baseImage = await Jimp.read(ASSET_BASE_PATH);
        
        const iconSize = 420; 
        const offset = (iconSize / 2) + 15; 

        const cx = baseImage.getWidth() / 2;
        const cy = baseImage.getHeight() / 2;

        const positions = [
            { x: cx - (iconSize / 2), y: cy - (iconSize / 2) - offset },  // Topo (⬆️)
            { x: cx - (iconSize / 2) - offset, y: cy - (iconSize / 2) },  // Esquerda (⬅️)
            { x: cx - (iconSize / 2) + offset, y: cy - (iconSize / 2) },  // Direita (➡️)
            { x: cx - (iconSize / 2), y: cy - (iconSize / 2) + offset }   // Baixo (⬇️)
        ];

        for (let i = 0; i < Math.min(perks.length, 4); i++) {
            const perk = perks[i];
            if (!perk.image) continue;

            const iconUrl = `https://cdn.nightlight.gg/img/${perk.image}`;
            
            const response = await axios.get(iconUrl, { responseType: 'arraybuffer' });
            
            const pngBuffer = await sharp(Buffer.from(response.data))
                .png()
                .toBuffer();

            const perkIcon = await Jimp.read(pngBuffer);

            perkIcon.resize(iconSize, iconSize);

            baseImage.composite(perkIcon, positions[i].x, positions[i].y, {
                mode: Jimp.BLEND_SOURCE_OVER,
                opacitySource: 1
            });
        }

        await baseImage.writeAsync(TEMP_IMAGE_PATH);
        console.log('✅ Imagem composta gerada com sucesso e centralizada!');
        
        return new AttachmentBuilder(TEMP_IMAGE_PATH, { name: 'shrine.png' });
    } catch (error) {
        console.error('❌ Erro ao gerar a imagem:', error);
        return null;
    }
}

async function buscarSantuarioEmbeds() {
    try {
        const response = await fetch('https://api.nightlight.gg/v1/shrine');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const dados = await response.json();

        if (!dados || !dados.data || !dados.data.perks) throw new Error('Dados da API em formato inválido');

        // 📅 Lógica corrigida: Travando o ciclo de Terça a Terça
        const agora = new Date();
        let dataInicio = new Date(agora);
        let diaSemana = dataInicio.getUTCDay(); // 0 = Domingo, 2 = Terça
        
        let diasParaTerca = (diaSemana >= 2) ? (diaSemana - 2) : (diaSemana + 5);
        
        // Se for terça-feira, mas antes das 15:00 UTC (12:00 BRT), pertence à semana anterior
        if (diaSemana === 2 && agora.getUTCHours() < 15) {
            diasParaTerca += 7;
        }
        
        dataInicio.setUTCDate(dataInicio.getUTCDate() - diasParaTerca);
        dataInicio.setUTCHours(15, 0, 0, 0); // 15:00 UTC = 12:00 BRT

        // O fim é exatamente 7 dias depois do início
        const dataFim = new Date(dataInicio);
        dataFim.setUTCDate(dataFim.getUTCDate() + 7);

        const formatadorData = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });

        const inicioTexto = formatadorData.format(dataInicio).replace(' às ', ' ');
        const fimTexto = formatadorData.format(dataFim).replace(' às ', ' ');

        let listaPerks = '';
        if (dados.data.perks.length > 0) {
            dados.data.perks.forEach((perk, index) => {
                const nomePerk = perk.name || 'Desconhecido';
                const emojiPosicao = POSICOES_EMOJI[index] || '•';
                listaPerks += `${emojiPosicao} **${nomePerk}**\n`;
            });
        } else {
            listaPerks = '⚠️ Nenhuma vantagem encontrada na rotação atual.\n';
        }

        const description = `**Perks**\n\n${listaPerks}\n**Data**\n\nIniciou dia: \`${inicioTexto}\`\nTermina dia: \`${fimTexto}\``;

        const imageAttachment = await gerarImagemSantuario(dados.data.perks);
        
        if (!imageAttachment) {
             throw new Error('Falha na geração da imagem');
        }

        const mainEmbed = new EmbedBuilder()
            .setTitle('💠 Santuário dos Segredos')
            .setColor('#2b2d31')
            .setDescription(description)
            .setImage('attachment://shrine.png')
            .setFooter({ text: CREDITO_BOT, iconURL: URL_FOTO_DEV })
            .setTimestamp();

        return { embeds: [mainEmbed], files: [imageAttachment] };
    } catch (error) {
        console.error('❌ Erro ao buscar API ou gerar imagem:', error.message);
        return null;
    }
}

async function dispararAtualizacaoGeral() {
    console.log('🔄 Disparando atualização global do Santuário...');
    const result = await buscarSantuarioEmbeds();
    if (!result || !result.embeds || result.embeds.length === 0) {
        throw new Error('Falha ao obter embeds do Santuário.');
    }

    const canaisConfigurados = lerCanais();
    let enviados = 0;
    let erros = 0;

    for (const [guildId, channelId] of Object.entries(canaisConfigurados)) {
        try {
            const canal = await client.channels.fetch(channelId);
            if (canal && canal.isTextBased()) {
                await canal.send({ content: '🔔 **O Santuário atualizou!**', ...result });
                console.log(`✅ Santuário enviado para o canal ${channelId} no servidor ${guildId}`);
                enviados++;
            }
        } catch (error) {
            console.error(`❌ Erro ao enviar para o canal ${channelId} no servidor ${guildId}:`, error.message);
            erros++;
        }
    }

    return { enviados, erros };
}

const commands = [
    new SlashCommandBuilder()
        .setName('shrine')
        .setDescription('Mostra o santuário atual do DBD com a imagem composta'),
    new SlashCommandBuilder()
        .setName('setcanal')
        .setDescription('Define o canal onde o bot enviará as atualizações automáticas')
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('Canal de texto para os anúncios do santuário')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder()
        .setName('atualizar')
        .setDescription('⚡ [DONO] Força o envio imediato da atualização do Santuário para todos os canais'),
    new SlashCommandBuilder()
        .setName('contato')
        .setDescription('📱 Entre em contato com o desenvolvedor do bot')
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

    // Configurado para rodar exatamente toda TERÇA-FEIRA (2) às 12:05
    cron.schedule('5 12 * * 2', async () => {
        try {
            await dispararAtualizacaoGeral();
        } catch (error) {
            console.error('❌ Erro na execução automática:', error);
        }
    }, {
        timezone: "America/Sao_Paulo"
    });
    
    console.log('⏰ Agendamento configurado: Toda Terça-feira às 12:05 (BRT)');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setcanal') {
        const canal = interaction.options.getChannel('canal');
        
        salvarCanal(interaction.guildId, canal.id);
        return interaction.reply({ 
            content: `✅ Canal de atualizações configurado com sucesso para <#${canal.id}>! O bot enviará o Santuário a cada 7 dias aqui.${CREDITO_TEXTO}`,
            ephemeral: true 
        });
    }

    if (interaction.commandName === 'atualizar') {
        if (interaction.user.id !== SEU_DISCORD_ID) {
            return interaction.reply({ 
                content: '❌ Apenas o desenvolvedor do bot pode executar esse comando global.', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const relatorio = await dispararAtualizacaoGeral();
            await interaction.editReply({ 
                content: `🚀 **Atualização disparada com sucesso!**\n\n✅ **Enviados:** ${relatorio.enviados} servidor(es)\n❌ **Falhas:** ${relatorio.erros} servidor(es)`
            });
        } catch (error) {
            console.error('❌ Erro no comando /atualizar:', error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao disparar a atualização geral.' });
        }
    }

    if (interaction.commandName === 'shrine') {
        await interaction.deferReply();

        try {
            const result = await buscarSantuarioEmbeds();
            if (result && result.embeds && result.embeds.length > 0) {
                await interaction.editReply(result);
                console.log(`✅ Comando /shrine executado por ${interaction.user.tag} no servidor ${interaction.guildId}`);
            } else {
                await interaction.editReply(`❌ Erro ao buscar o Santuário. Tente novamente mais tarde.${CREDITO_TEXTO}`);
            }
        } catch (error) {
            console.error('❌ Erro no comando /shrine:', error);
            await interaction.editReply(`❌ Ocorreu um erro ao processar sua solicitação.${CREDITO_TEXTO}`);
        }
    }

    if (interaction.commandName === 'contato') {
        const embedContato = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: '👨‍💻 Anthonny Michael', iconURL: URL_FOTO_DEV })
            .setTitle('📱 Entre em Contato com o Desenvolvedor')
            .setDescription('Olá! Sou o **Anthonny Michael**, desenvolvedor deste bot. Fique à vontade para entrar em contato comigo através das minhas redes sociais abaixo, caso tenha algum problema ou dúvida sobre o bot:')
            .setThumbnail(URL_FOTO_DEV)
            .addFields(
                { 
                    name: '👨‍💻 Sobre Mim', 
                    value: 'Sou um desenvolvedor apaixonado por tecnologia e automação. Este bot foi criado para manter a comunidade atualizada sobre o Santuário dos Segredos!',
                    inline: false 
                },
                { 
                    name: '📱 Redes Sociais', 
                    value: 'Clique nos botões abaixo para me seguir e acompanhar meu trabalho!',
                    inline: false 
                }
            )
            .setFooter({ text: CREDITO_BOT, iconURL: URL_FOTO_DEV })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('📸 Instagram')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://www.instagram.com/_ofcanthonny_santos__/')
                    .setEmoji('📸'),
                new ButtonBuilder()
                    .setLabel('🎵 TikTok')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://www.tiktok.com/@anthonny_secbr')
                    .setEmoji('🎵'),
                new ButtonBuilder()
                    .setLabel('💼 LinkedIn')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://www.linkedin.com/in/anthonny-michael/')
                    .setEmoji('💼'),
                new ButtonBuilder()
                    .setLabel('🐙 GitHub')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://github.com/Antonizinhobr')
                    .setEmoji('🐙')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('💬 Discord')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.com/users/anthonnybrbr')
                    .setEmoji('💬')
            );

        return interaction.reply({ 
            embeds: [embedContato], 
            components: [row, row2],
            ephemeral: true 
        });
    }
});

client.on('error', (error) => console.error('❌ Erro no cliente Discord:', error));
client.on('disconnect', () => console.log('⚠️ Bot desconectado. Tentando reconectar...'));

console.log('⏳ Conectando à Entidade...');
client.login(TOKEN).catch(error => {
    console.error('❌ Erro ao fazer login:', error);
    process.exit(1);
});