# Setting Up Supabase for NCCF Roster

We have fully migrated the codebase from JSONBin to **Supabase**! Because Supabase uses a real PostgreSQL database under the hood, your data is permanently safe and completely immune to Render server restarts.

Follow these final steps to activate the database:

## Step 1: Create a Supabase Project
1. Go to [database.new](https://database.new) (which will redirect you to the Supabase dashboard).
2. Create a new project. Name it `nccf-roster` (or whatever you prefer) and set a secure database password.
3. Wait about 1-2 minutes for the database to finish setting up.

## Step 2: Push the Database Tables
Now that you have a remote database, we need to push our tables to it.
1. On your Supabase dashboard, look at your project URL (e.g., `https://supabase.com/dashboard/project/abcdefghijklmnopqrst`). The random string of letters at the end (`abcdefghijklmnopqrst`) is your **Reference ID**.
2. Open your computer's terminal (inside your `nccf_family` folder) and run this command:
   ```bash
   supabase link --project-ref <YOUR_REFERENCE_ID>
   ```
   *(It will ask for your database password from Step 1. Type it in and press Enter. It won't show characters as you type).*
3. Run this command to push the tables to the remote database:
   ```bash
   supabase db push
   ```

## Step 3: Add the Keys to Render
Finally, tell Render how to connect to the database.
1. Go to your Supabase Dashboard -> **Project Settings** (gear icon) -> **API**.
2. Find the **Project URL**. Copy it.
3. Find the **service_role** secret key. Copy it. (Do NOT use the anon public key).
4. Go to your [Render Dashboard](https://dashboard.render.com), open your web service, and go to **Environment**.
5. Add the following two Environment Variables:
   - `SUPABASE_URL` = *(Paste your Project URL here)*
   - `SUPABASE_SERVICE_KEY` = *(Paste your service_role secret here)*
6. Delete the old JSONBIN variables if they are still there.
7. Click **Save Changes**.

Render will restart, and your Supabase database is now completely live!
