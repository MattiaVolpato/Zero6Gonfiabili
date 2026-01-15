# Gonfiabili SPA - Gestionale per Noleggio Gonfiabili

Applicazione web Single Page Application (SPA) per la gestione di un'attività di noleggio gonfiabili.

## 🎥 Video Demo
[Guarda la demo su YouTube](https://www.youtube.com/watch?v=dQw4w9WgXcQ) *(Link dimostrativo)*

---

## 🚀 Istruzioni per l'Installazione

### Prerequisiti
- **Node.js** (versione 14 o superiore)
- **NPM** (incluso in Node.js)

### Setup
1.  **Clona il repository** (o scarica lo zip):
    ```bash
    git clone https://github.com/MattiaVolpato/Zero6Gonfiabili.git
    ```

2.  **Installa le dipendenze**:
    ```bash
    npm install
    ```

3.  **Configurazione Ambassador**:
    Crea un file `.env` nella root del progetto (puoi copiare `.env.example`):
    ```env
    # Esempio configurazione minima
    PORT=3000
    SESSION_SECRET=super-segreto-cambiami
    ```

4.  **Inizializza il Database**:
    Esegui lo script di reset per creare le tabelle e popolare i dati di prova:
    ```bash
    npm run db:reset
    ```

5.  **Avvia il Server**:
    ```bash
    npm run dev
    ```
    Il server partirà all'indirizzo `http://localhost:3000`.

---

## 🧪 Utenti di Prova (Test Credentials)

Per testare l'applicazione puoi utilizzare i seguenti utenti pre-configurati:

### 👑 Amministratore
Accesso completo al pannello di controllo (`/admin`).
- **Email**: `admin@example.com`
- **Password**: `admin123`

### 👤 Utente Standard
Accesso funzionalità cliente (prenotazioni, profilo, etc).
- **Email**: `test@example.com`
- **Password**: `password`

### Altri utenti demo
- `lucia@example.com` / `password`
- `marco@example.com` / `password`

---

## 🛠 Tecnologie Utilizzate
- **Backend**: Node.js, Express, SQLite, Passport.js
- **Frontend**: Vanilla JS (SPA), CSS personalizzato (no framework esterni)
- **Security**: Helmet, CSURF, bcrypt, Express-Session
