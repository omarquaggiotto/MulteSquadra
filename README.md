# Multe Squadra

Applicazione multi-squadra separata da MulteSV e MulteGS. La versione locale verifica il flusso:

1. login del responsabile;
2. codice di attivazione fornito dal gestore;
3. codice squadra Tuttocampo;
4. anteprima della squadra rilevata;
5. creazione di un profilo isolato.

Il codice locale di prova è `PROVA-SQUADRA-2026`. Consente di configurare una squadra reale da Tuttocampo senza creare utenti online e senza leggere o modificare i dati di MulteSV o MulteGS. La base definitiva usa Supabase Auth, codici monouso e Row Level Security per squadra.

## Comandi

- `npm run dev`: avvia la prova locale.
- `npm run check`: controlla sintassi, PWA, calendario, Coppa, Maps e struttura.
- `npm run check:db`: esegue i test database quando Supabase CLI è disponibile.

Vedi [architettura](docs/ARCHITECTURE.md) e [procedura di pubblicazione](docs/DEPLOYMENT.md).

## Importazione rosa Tuttocampo

Le rose che Tuttocampo rende disponibili solo agli utenti registrati vengono lette dal server tramite un account dedicato. Impostare `TUTTOCAMPO_USERNAME` e `TUTTOCAMPO_PASSWORD` nell'ambiente del server. Le credenziali non devono essere inserite nel frontend, in localStorage o nel repository; `.env` e `.env.local` sono esclusi dal controllo versione.
