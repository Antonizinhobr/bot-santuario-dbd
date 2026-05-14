# 💠 Bot Santuário dos Segredos (Dead by Daylight)

![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue?logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-LTS-green?logo=node.js&logoColor=white)
![API](https://img.shields.io/badge/API-Nightlight.gg-purple)

Um bot para Discord focado no universo de **Dead by Daylight**. Ele se conecta à API do *Nightlight.gg* para buscar e exibir as vantagens (perks) disponíveis no **Santuário dos Segredos** da semana, com imagens, custos em fragmentos e taxas de uso.

A grande vantagem deste bot é a sua função de **Atualização Automática (Multi-Servidor)**: ele pode ser configurado em dezenas de servidores simultaneamente e, toda terça-feira (às 12:05 BRT), ele enviará a nova rotação do santuário de forma automática no canal escolhido de cada servidor!

---

## ✨ Funcionalidades

* **🔎 Consulta Rápida:** Use um comando simples para ver a rotação atual do santuário a qualquer momento.
* **⏰ Atualização Automática:** Toda terça-feira, o bot envia sozinho a nova rotação do santuário nos canais configurados.
* **💾 Multi-Servidor Independente:** Salva o canal de configuração de cada servidor localmente em um arquivo `canais.json`.
* **🎨 Embeds Ricos:** As mensagens são enviadas em painéis bonitos e organizados, contendo o ícone da vantagem, personagem de origem, custo de fragmentos e taxa de uso na comunidade.

---

## 💻 Comandos (Slash Commands)

* **`/shrine`**
  * **O que faz:** Mostra o santuário atual do DBD com imagens, estatísticas e um contador de tempo regressivo para a próxima rotação.
  * **Permissão:** Qualquer membro do servidor.

* **`/setcanal`**
  * **O que faz:** Define o canal onde o bot enviará as atualizações automáticas de terça-feira.
  * **Parâmetros:**
    * `canal` (Obrigatório): O canal de texto ou anúncios onde o bot vai postar.
  * **Permissão:** Apenas Administradores.

---

## 📂 Estrutura de Arquivos

Esta é a estrutura de arquivos do projeto:

```text
bot-shrine/
 ├── node_modules/       # Dependências do Node.js (gerado automaticamente)
 ├── .env                # Suas variáveis de ambiente (🔒 NUNCA compartilhe)
 ├── .gitignore          # Arquivos ignorados pelo Git (.env, node_modules)
 ├── discloud.config     # Arquivo de configuração para hospedagem na Discloud
 ├── index.js            # O código principal do bot
 ├── package-lock.json   # Trava das versões das dependências
 ├── package.json        # Informações e pacotes do projeto
 └── canais.json         # Banco de dados local (criado automaticamente ao usar o bot)
```

---

## 🛠️ Guia de Instalação e Hospedagem

> [!IMPORTANT]
> **Este bot é de uso público!** Você **não precisa** baixar o código, configurá-lo na sua máquina ou pagar por hospedagem para utilizá-lo. Basta adicioná-lo ao seu servidor através do link de convite oficial e ele estará pronto para uso.
> 
> O guia de instalação local e hospedagem abaixo é destinado **apenas** a desenvolvedores que desejam realizar o **Self-Hosting** (hospedagem própria) para ter uma instância 100% privada e customizável do bot.

### 1. Pré-requisitos (Local)
* Ter o [Node.js](https://nodejs.org/) instalado na sua máquina.
* Ter criado uma aplicação no [Discord Developer Portal](https://discord.com/developers/applications).
* Guardar o **Token** do Bot e o **Client ID** (ID do Aplicativo).

### 2. Configurando o Projeto
Abra o terminal na pasta do seu projeto e instale as dependências necessárias:

```bash
npm install discord.js dotenv node-cron
```

### 3. Variáveis de Ambiente (.env)
Crie um arquivo chamado `.env` na raiz do projeto e preencha com as suas credenciais copiadas do portal do desenvolvedor:

```env
TOKEN=SEU_TOKEN_AQUI
CLIENT_ID=SEU_CLIENT_ID_AQUI
```

### 4. Iniciando o Bot
No terminal, digite o comando abaixo para iniciar:

```bash
node index.js
```
Se o console mostrar `🤖 Bot online!` e `✅ Comandos registrados com sucesso!`, sua configuração funcionou.

---

## ☁️ Como Hospedar na Discloud (Para ficar online 24/7)

Se você quer que sua versão privada do bot fique online dia e noite, pode usar a hospedagem da [Discloud](https://discloudbot.com/).

### 1. Preparando o `discloud.config`
Crie (ou edite) o arquivo `discloud.config` na raiz do projeto com as seguintes informações:

```ini
NAME=BotShrine
TYPE=bot
MAIN=index.js
RAM=100
AUTORESTART=true
VERSION=latest
APT=tools
```

### 2. Compactando os Arquivos
Crie um arquivo **.zip** contendo apenas os seguintes arquivos:
* `index.js`
* `package.json`
* `discloud.config`
* `.env`
* `canais.json` (se já existir)

⚠️ **IMPORTANTE:** NUNCA inclua a pasta `node_modules` no arquivo `.zip`. A Discloud cuida da instalação automaticamente.

### 3. Subindo o Bot
1. Acesse seu painel na Discloud.
2. Clique em **Adicionar App** (Add App).
3. Faça o upload do seu arquivo `.zip` e inicie a aplicação. Pronto, seu bot do Santuário viverá para sempre na nuvem!

---
*Atualizado pela Entidade.* 🕷️