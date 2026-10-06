// server.js (Node/Express backend)
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  user: 'postgres', // Update with your actual user
  host: 'localhost',
  database: 'delivery_db',
  password: '123456789',
  port: 5432,
});

const SECRET_KEY = process.env.JWT_SECRET || 'super-secure-key';

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Register Route
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
      [username, hashedPassword, 'admin']
    );
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: 'Registration failed. Username might already exist.' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query('SELECT id, password_hash, role FROM users WHERE username = $1', [username]);
  const user = result.rows[0];

  if (user && await bcrypt.compare(password, user.password_hash)) {
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// Secure PII Dashboard Route
app.get('/api/pii-dashboard', authenticateToken, async (req, res) => {
  try {
    const piiData = await pool.query(
      `SELECT id, order_id, name, order_name, social_security_number, driver_license, 
              dob, phone_number, credit_card_number_visa, credit_card_number_master, 
              address, resident_registration_number, business_registration_number 
       FROM deliveries ORDER BY id ASC`
    );
    res.json(piiData.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// CREATE: Add a new delivery record
app.post('/api/deliveries', authenticateToken, async (req, res) => {
  const { order_id, name, order_name, social_security_number, driver_license, dob, phone_number, credit_card_number_visa, credit_card_number_master, address, resident_registration_number, business_registration_number } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO deliveries (order_id, name, order_name, social_security_number, driver_license, dob, phone_number, credit_card_number_visa, credit_card_number_master, address, resident_registration_number, business_registration_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [order_id, name, order_name, social_security_number, driver_license, dob, phone_number, credit_card_number_visa, credit_card_number_master, address, resident_registration_number, business_registration_number]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

// UPDATE: Modify an existing record
app.put('/api/deliveries/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { order_id, name, order_name, social_security_number, driver_license, dob, phone_number, credit_card_number_visa, credit_card_number_master, address, resident_registration_number, business_registration_number } = req.body;
  try {
    const result = await pool.query(
      `UPDATE deliveries
       SET order_id=$1, name=$2, order_name=$3, social_security_number=$4, driver_license=$5, dob=$6, phone_number=$7, credit_card_number_visa=$8, credit_card_number_master=$9, address=$10, resident_registration_number=$11, business_registration_number=$12
       WHERE id=$13 RETURNING *`,
      [order_id, name, order_name, social_security_number, driver_license, dob, phone_number, credit_card_number_visa, credit_card_number_master, address, resident_registration_number, business_registration_number, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// DELETE: Remove a record
app.delete('/api/deliveries/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM deliveries WHERE id = $1', [id]);
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));