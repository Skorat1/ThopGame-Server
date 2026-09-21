import mysql from 'mysql';
import dotenv from 'dotenv';

dotenv.config();

async function resetPlays() {
  const host = process.env.MYSQL_HOST || 'localhost';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'thopgames';
  const port = Number(process.env.MYSQL_PORT) || 3306;

  // Reset plays in MySQL
  const conn = mysql.createConnection({ host, user, password, database, port });
  conn.connect(err => {
    if (err) {
      console.error('❌ MySQL Connection Error:', err.message);
    } else {
      console.log('✅ Connected to MySQL database');
      conn.query('UPDATE games SET plays = 0, likes = 0, dislikes = 0', (qErr, result) => {
        if (qErr) {
          console.error('MySQL update error:', qErr.message);
        } else {
          console.log(`✅ MySQL: Reset plays to 0 for ${result.affectedRows} games.`);
        }
        conn.end();
      });
    }
  });
}

resetPlays();
