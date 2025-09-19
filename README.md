# Live Sports Trivia

This is a real-time "second screen" trivia application designed to run concurrently with live sports matches. Fans can join a game, pick a team, and answer trivia questions pushed to their device every few minutes. Scores are aggregated by team, creating a "game within the game" for fans to compete.

This project is built with:
* **Frontend:** React (Vite) + TailwindCSS
* **Backend:** Supabase (PostgreSQL, Auth, and Edge Functions)
* **Live Data:** TheSportsDB API
* **Hosting:** GitHub Pages

---

## 🚀 Project Setup

To run this project, you will need an active account with Supabase.

### 1. Supabase Setup

1.  **Create Project:** Go to [Supabase](https://supabase.com) and create a new project.
2.  **Database Tables:** Go to the **SQL Editor** and run the SQL queries (from this project's documentation) to create the `questions`, `games`, `profiles`, and `answers` tables.
3.  **Edge Function (`game-tick`):**
    * Go to **Edge Functions** and create a new function named `game-tick`.
    * Copy the code from `supabase/functions/game-tick/index.ts` into the dashboard editor.
    * Go to the **Secrets** setting for that function and add:
        * `SUPABASE_URL`: Your project's URL (from Project Settings > API).
        * `SUPABASE_SERVICE_ROLE_KEY`: Your `service_role` key (from Project Settings > API).
        * `SPORTS_API_KEY`: Your API key from TheSportsDB (123 for free accounts).
    * Deploy the function.
4.  **Auth Providers:**
    * Go to **Authentication > Providers** and enable your desired providers (e.g., Google, Apple).
    * Go to **Authentication > Settings** and toggle on **"Allow anonymous sign-ins"**.

### 2. Local Project Setup

1.  **Clone the Repo:**
    ```bash
    git clone [https://github.com/YOUR_USERNAME/YOUR_REPO.git](https://github.com/YOUR_USERNAME/YOUR_REPO.git)
    cd YOUR_REPO
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Create Environment File:**
    * Create a file named `.env` in the root of the project.
    * Add your Supabase **public** keys to it. (Find these in Supabase > Project Settings > API).
    ```
    VITE_SUPABASE_URL=https://YOUR_PROJECT_URL.supabase.co
    VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
    ```

4.  **Run the App:**
    ```bash
    npm run dev
    ```

### 3. GitHub Setup (Secrets)

For the `game-tick` function to run on its schedule, you must set up secrets for the GitHub Action.

1.  Go to your GitHub Repo > **Settings > Secrets and variables > Actions**.
2.  Click **"New repository secret"** and add the following:
    * `SUPABASE_FUNCTION_URL`: The "Invoke URL" for your `game-tick` function.
    * `SUPABASE_ANON_KEY`: Your public `anon` key.
    * `SUPABASE_SERVICE_ROLE_KEY`: Your `service_role` secret key.