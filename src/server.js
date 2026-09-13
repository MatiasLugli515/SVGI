// src/server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para procesar datos en formato JSON (útil para los fetch)
app.use(express.json());

// Configurar la carpeta 'public' para servir archivos estáticos (HTML, CSS, JS del frontend)
// path.join(__dirname, '../public') asegura que la ruta sea correcta independientemente de dónde se ejecute
app.use(express.static(path.join(__dirname, '../public')));

// Ruta principal que redirige al login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Iniciar el servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de SGVI ejecutándose en http://localhost:${PORT}`);
});