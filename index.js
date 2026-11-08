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
const express = require('express');
const cors = require('cors');

if (!process.env.TOKEN || !process.env.CLIENT_ID) {
    console.error('❌ Erro: Variáveis de ambiente não configuradas corretamente!');
    console.error('Certifique-se de ter um arquivo .env com: TOKEN e CLIENT_ID');
    process.exit(1);
}

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const SEU_DISCORD_ID = '1400218900284571689';

const DB_PATH = './canais.json';
const ASSET_BASE_PATH = path.join(__dirname, 'assets', 'shrine_base.png');

const URL_FOTO_DEV = 'https://avatars.githubusercontent.com/Antonizinhobr';

// ───────────────────────── Identidade visual do Santuário ─────────────────────────
const COR_SANTUARIO = 0x8A2BE2; // roxo do Santuário (combina com a arte da imagem)
const URL_WIKI_SANTUARIO = 'https://deadbydaylight.fandom.com/wiki/Shrine_of_Secrets';
const URL_PERKS_NIGHTLIGHT = 'https://nightlight.gg/perks/'; // página da perk com descrição e estatísticas de uso
const POSICOES_EMOJI = ['⬆️', '⬅️', '➡️', '⬇️'];
const ESPACO = '​';

// usage_tier vem da API do Nightlight
const POPULARIDADE = {
    veryhigh: { barra: '▰▰▰▰▰', texto: 'Muito alta' },
    high:     { barra: '▰▰▰▰▱', texto: 'Alta' },
    average:  { barra: '▰▰▰▱▱', texto: 'Média' },
    low:      { barra: '▰▰▱▱▱', texto: 'Baixa' },
    verylow:  { barra: '▰▱▱▱▱', texto: 'Muito baixa' }
};

const formatarNumero = (n) => new Intl.NumberFormat('pt-BR').format(n);
// Timestamps nativos do Discord: cada pessoa vê no próprio fuso, e o estilo "R" vira contagem regressiva ao vivo
const timestampDiscord = (data, estilo) => `<t:${Math.floor(data.getTime() / 1000)}:${estilo}>`;

// IDs dos comandos registrados, para gerar menções clicáveis tipo </contato:123>
const idsComandos = {};
function mencionarComando(nome) {
    return idsComandos[nome] ? `</${nome}:${idsComandos[nome]}>` : `**/${nome}**`;
}
function linhaContato(texto = 'Dúvidas ou sugestões? Fale com o desenvolvedor:') {
    return `-# 💬 ${texto} ${mencionarComando('contato')}`;
}

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

// ───────────────────────── Imagem (gerada em memória + cache por semana) ─────────────────────────
let cacheImagem = { chave: null, buffer: null };

async function baixarIcone(perk) {
    const { data } = await axios.get(`https://cdn.nightlight.gg/img/${perk.image}`, {
        responseType: 'arraybuffer',
        timeout: 15000
    });
    const pngBuffer = await sharp(Buffer.from(data)).png().toBuffer();
    return Jimp.read(pngBuffer);
}

async function gerarImagemSantuario(perks, chave) {
    if (chave && cacheImagem.chave === chave && cacheImagem.buffer) {
        console.log('⚡ Imagem do Santuário servida do cache.');
        return cacheImagem.buffer;
    }

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

        // Baixa os 4 ícones em paralelo (bem mais rápido que um por um)
        const selecionadas = perks.slice(0, 4);
        const icones = await Promise.all(selecionadas.map(perk => (perk.image ? baixarIcone(perk) : null)));

        icones.forEach((icone, i) => {
            if (!icone) return;
            icone.resize(iconSize, iconSize);
            baseImage.composite(icone, positions[i].x, positions[i].y, {
                mode: Jimp.BLEND_SOURCE_OVER,
                opacitySource: 1
            });
        });

        // Em memória: sem arquivo temporário, então dois /shrine ao mesmo tempo não se atropelam
        const buffer = await baseImage.getBufferAsync(Jimp.MIME_PNG);
        if (chave) cacheImagem = { chave, buffer };
        console.log('✅ Imagem composta gerada com sucesso!');
        return buffer;
    } catch (error) {
        console.error('❌ Erro ao gerar a imagem:', error);
        return null;
    }
}

// ───────────────────────── Datas ─────────────────────────
function lerDataUTC(valor) {
    if (!valor) return null;
    // A API manda "2026-11-03T15:00:00" sem fuso: é UTC
    const texto = /([zZ]|[+-]\d{2}:?\d{2})$/.test(valor) ? valor : `${valor}Z`;
    const data = new Date(texto);
    return Number.isNaN(data.getTime()) ? null : data;
}

function calcularPeriodoPadrao() {
    const agora = new Date();
    const inicio = new Date(agora);
    const diaSemana = inicio.getUTCDay();

    let diasParaTerca = (diaSemana >= 2) ? (diaSemana - 2) : (diaSemana + 5);
    if (diaSemana === 2 && agora.getUTCHours() < 15) {
        diasParaTerca += 7;
    }

    inicio.setUTCDate(inicio.getUTCDate() - diasParaTerca);
    inicio.setUTCHours(15, 0, 0, 0);

    const fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + 7);
    return { inicio, fim };
}

function obterPeriodo(santuario) {
    const inicio = lerDataUTC(santuario.start);
    let fim = lerDataUTC(santuario.end);
    if (!inicio || !fim) return calcularPeriodoPadrao();
    // "14:59:59" → arredonda para 15:00 (12:00 em Brasília)
    if (fim.getUTCSeconds() === 59) fim = new Date(fim.getTime() + 1000);
    return { inicio, fim };
}

// ───────────────────────── Montagem da embed ─────────────────────────
function tipoDoPersonagem(personagem) {
    if (!personagem) return { emoji: '🎲', rotulo: 'Perk geral' };
    return /^The\s/i.test(personagem)
        ? { emoji: '🔪', rotulo: 'Assassino' }
        : { emoji: '🏃', rotulo: 'Sobrevivente' };
}

function linkPerk(nomePerk) {
    // "A Nurse's Calling" → https://nightlight.gg/perks/A_Nurse%27s_Calling
    const slug = encodeURIComponent(nomePerk.replace(/ /g, '_'))
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
    return URL_PERKS_NIGHTLIGHT + slug;
}

function montarCampoPerk(perk, index) {
    const tipo = tipoDoPersonagem(perk.character);
    const linhas = [`${tipo.emoji} ${perk.character || tipo.rotulo}`];

    if (Number.isFinite(perk.shards)) {
        linhas.push(`💎 ${formatarNumero(perk.shards)} fragmentos`);
    }

    const popularidade = POPULARIDADE[perk.usage_tier];
    if (popularidade) {
        linhas.push(`📊 ${popularidade.barra} ${popularidade.texto}`);
    }

    return {
        name: `${POSICOES_EMOJI[index] || '•'} ${perk.name || 'Desconhecida'}`,
        value: linhas.join('\n'),
        inline: true
    };
}

function montarCamposEmGrade(perks) {
    // Grade 2x2 que espelha o losango da imagem (o 3º campo invisível força 2 por linha no PC)
    const campos = [];
    perks.forEach((perk, i) => {
        campos.push(montarCampoPerk(perk, i));
        if (i % 2 === 1) campos.push({ name: ESPACO, value: ESPACO, inline: true });
    });
    return campos;
}

function montarBotoes(perks) {
    const botoes = perks
        .filter(perk => perk.name)
        .slice(0, 5)
        .map((perk, i) => new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel(perk.name.slice(0, 80))
            .setEmoji(POSICOES_EMOJI[i] || '📖')
            .setURL(linkPerk(perk.name)));

    return botoes.length ? [new ActionRowBuilder().addComponents(botoes)] : [];
}

async function buscarSantuarioEmbeds() {
    try {
        const response = await fetch('https://api.nightlight.gg/v1/shrine');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const dados = await response.json();

        if (!dados || !dados.data || !Array.isArray(dados.data.perks)) throw new Error('Dados da API em formato inválido');

        const santuario = dados.data;
        const perks = santuario.perks;
        const { inicio, fim } = obterPeriodo(santuario);

        const linhas = [
            '> *Novas perks chegaram ao Santuário. Garanta as suas antes que a Entidade as leve embora.*',
            '',
            `⏳ Renova **${timestampDiscord(fim, 'R')}**`,
            `📅 ${timestampDiscord(inicio, 'f')}  ➜  ${timestampDiscord(fim, 'f')}`
        ];

        const destaques = perks.filter(perk => perk.usage_tier === 'veryhigh' && perk.name);
        if (destaques.length > 0) {
            const nomes = destaques.map(perk => `**${perk.name}**`).join(' e ');
            const verbo = destaques.length > 1 ? 'estão' : 'está';
            linhas.push(`🔥 Destaque: ${nomes} ${verbo} entre as perks mais usadas do jogo`);
        }

        if (perks.length === 0) {
            linhas.push('', '⚠️ Nenhuma perk encontrada na rotação atual.');
        }

        const autor = { name: 'Dead by Daylight • Rotação semanal' };
        const avatarBot = client.user?.displayAvatarURL();
        if (avatarBot) autor.iconURL = avatarBot;

        const chaveImagem = `${santuario.week ?? 'semana'}:${perks.map(perk => perk.id ?? perk.name).join(',')}`;
        const imagem = perks.length > 0 ? await gerarImagemSantuario(perks, chaveImagem) : null;

        const mainEmbed = new EmbedBuilder()
            .setColor(COR_SANTUARIO)
            .setAuthor(autor)
            .setTitle('💠 Santuário dos Segredos')
            .setURL(URL_WIKI_SANTUARIO)
            .setDescription(linhas.join('\n'))
            .addFields(
                ...montarCamposEmGrade(perks),
                { name: ESPACO, value: linhaContato(), inline: false }
            );

        // Se a imagem falhar, a embed sai mesmo assim (antes o comando inteiro quebrava)
        if (imagem) mainEmbed.setImage('attachment://shrine.png');

        return {
            embeds: [mainEmbed],
            files: imagem ? [new AttachmentBuilder(imagem, { name: 'shrine.png' })] : [],
            components: montarBotoes(perks)
        };
    } catch (error) {
        console.error('❌ Erro ao buscar API ou montar a embed:', error.message);
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
                await canal.send({ content: '🔔 **O Santuário dos Segredos foi renovado!**', ...result });
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
        const registrados = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        for (const comando of registrados) idsComandos[comando.name] = comando.id;
        console.log('✅ Comandos registrados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
})();

client.once('ready', async () => {
    console.log(`🤖 Bot online! Logado como ${client.user.tag}`);

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
            content: `✅ Tudo certo! O Santuário dos Segredos será anunciado em <#${canal.id}> toda terça-feira, assim que a rotação renovar.\n-# Quer ver o Santuário agora? Use ${mencionarComando('shrine')}`,
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
                await interaction.editReply(`❌ Não consegui buscar o Santuário agora. Tente novamente em instantes.\n${linhaContato('Se o problema continuar, avise o desenvolvedor:')}`);
            }
        } catch (error) {
            console.error('❌ Erro no comando /shrine:', error);
            await interaction.editReply(`❌ Ocorreu um erro ao processar sua solicitação.\n${linhaContato('Se o problema continuar, avise o desenvolvedor:')}`);
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
            );

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


const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('✅ A API do Refúgio da Névoa está Online e operante!');
});

app.get('/api/shrine', async (req, res) => {
    try {
        const response = await axios.get('https://api.nightlight.gg/v1/shrine');
        res.json(response.data);
    } catch (error) {
        console.error('❌ Erro na API do site:', error.message);
        res.status(500).json({ error: 'Erro ao buscar santuário' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🌐 API do Dashboard rodando na porta ${PORT}`));

console.log('⏳ Conectando à Entidade...');
client.login(TOKEN).catch(error => {
    console.error('❌ Erro ao fazer login:', error);
    process.exit(1);
});