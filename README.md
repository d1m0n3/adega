# 🍷 Adega dos Amigos

App para partilhar com amigos os vinhos que bebem: foto da garrafa, nota, comentário, preço, grupos, rankings e estatísticas.
**Os amigos não precisam de conta** — abrem o link de convite, escrevem o nome e já está.

Funciona em qualquer telemóvel pelo browser e pode ser instalada no ecrã principal (como uma app).

---

## Instalação (≈15 minutos, tudo gratuito)

### 1. Base de dados — Supabase
1. Cria conta em <https://supabase.com> e carrega em **New project** (região: *West EU*). Guarda a password.
2. No menu **SQL Editor** → **New query**, cola todo o conteúdo do ficheiro `supabase.sql` e carrega em **Run**.
3. Em **Authentication → Sign In / Providers**:
   - ativa **Allow anonymous sign-ins** (é o que permite entrar só com o nome);
   - deixa o **Email** ativo (serve para usar a mesma conta noutro telemóvel).
4. Em **Project Settings → API** copia o **Project URL** e a **anon public key**.

### 2. Configurar
Abre `config.js` e cola os dois valores:
```js
window.ADEGA_CONFIG = {
  SUPABASE_URL: "https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```
> A *anon key* pode ficar pública — a segurança é garantida pelas regras do `supabase.sql` (cada pessoa só vê os grupos onde está).

### 3. Publicar no GitHub Pages
1. Em <https://github.com/new> cria um repositório (ex.: `adega`), público.
2. **Add file → Upload files** e arrasta todos os ficheiros desta pasta → **Commit changes**.
3. **Settings → Pages** → *Source*: **Deploy from a branch**, *Branch*: `main` / `(root)` → **Save**.
4. Passado 1 minuto a app fica em `https://O-TEU-UTILIZADOR.github.io/adega/`.

### 4. Ligar o endereço ao Supabase
Em **Authentication → URL Configuration** põe o endereço do passo 3 em **Site URL** e também em **Redirect URLs**.
(Necessário para os links de email funcionarem.)

---

## Como usar
1. Abre a app, escreve o teu nome → **Grupos → ＋ Novo**.
2. Dentro do grupo carrega em **Convidar amigos** ou **WhatsApp** — os amigos abrem o link e entram logo no grupo.
3. Carrega no **＋** para tirar foto à garrafa e avaliar.
4. Para instalar no telemóvel: no iPhone, Safari → *Partilhar* → **Adicionar ao ecrã principal**; no Android, Chrome → ⋮ → **Instalar app**.

**Mudar de telemóvel:** em **Eu → Usar noutro telemóvel**, liga um email. No telemóvel novo escolhe *“Já usei noutro telemóvel”* e recebes um link de entrada. Sem email ligado, se limpares o browser perdes o acesso à tua conta (os vinhos ficam no grupo).

## Funcionalidades
- Feed por grupo com fotos, notas (meias estrelas), preço, aromas, comentários e 🥂 brindes
- Vinho da semana, pesquisa, filtros por tipo e ordenação
- “Também provei” — vários amigos avaliam o mesmo vinho e vês a média
- Rankings: melhores, qualidade/preço, mais caros, top por tipo
- Estatísticas pessoais e do grupo, com distintivos (Sommelier do grupo, Crítico exigente, Mãos largas, Caçador de pechinchas…)
- Lista “Queremos provar” por grupo
- Partilhar um vinho no WhatsApp

## Limites do plano gratuito do Supabase
500 MB de base de dados e 1 GB de fotos (≈ 5 000 fotos, já comprimidas pela app). Projetos sem atividade durante 7 dias são pausados — basta entrar no painel do Supabase e carregar em *Restore*.
