-- Create database if not exists
SELECT 'CREATE DATABASE fantasy_casino'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fantasy_casino')
\gexec
