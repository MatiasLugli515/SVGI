const express = require('express');
const path = require('path');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'f56509c00a30fe0b194dd13034b168e807838f9306359d91d3dfe0d8b7d2d0466d2ada71c222e5e14085bd5725593effab96eb358626709549ebabff35aee4c6';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const dbConfig = {
    user: 'candela',
    password: '1234',
    server: 'DESKTOP-6R4GSNU', 
    database: 'SGVI', 
    options: {
        instanceName: 'SQLEXPRESS', 
        trustServerCertificate: true,
        encrypt: false
    }
};

// Endpoint de Registro
app.post('/api/registro', async (req, res) => {
    const { nombre, email, password } = req.body;

    try {
        let pool = await sql.connect(dbConfig);
        
        const userExist = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT ID_Usuario FROM Usuarios WHERE Email = @email');

        if (userExist.recordset.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
        }

        // 2. Encriptar contraseña y asignar rol por defecto
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const rolPorDefecto = 'operario';

        // 3. Insertar en la base de datos
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('email', sql.VarChar, email)
            .input('passwordHash', sql.VarChar, passwordHash)
            .input('rol', sql.VarChar, rolPorDefecto)
            .query('INSERT INTO Usuarios (Nombre, Email, Password_Hash, Rol) VALUES (@nombre, @email, @passwordHash, @rol)');

        res.status(201).json({ message: 'Usuario registrado con éxito' });

    } catch (err) {
        console.error('Error en el registro:', err);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Endpoint de Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        let pool = await sql.connect(dbConfig);
        
        const userResult = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT ID_Usuario, Nombre, Password_Hash, Rol FROM Usuarios WHERE Email = @email');

        if (userResult.recordset.length === 0) {
            return res.status(401).json({ message: 'Correo electrónico o contraseña incorrectos.' });
        }

        const usuario = userResult.recordset[0];

        const isMatch = await bcrypt.compare(password, usuario.Password_Hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Correo electrónico o contraseña incorrectos.' });
        }

        const token = jwt.sign(
            { id: usuario.ID_Usuario, rol: usuario.Rol, nombre: usuario.Nombre },
            SECRET_KEY,
            { expiresIn: '8h' }
        );

        const depositosResult = await pool.request()
            .query('SELECT ID_Deposito, Nombre FROM Depositos');

        res.status(200).json({
            message: 'Autenticación exitosa',
            token: token,
            depositos: depositosResult.recordset
        });

    } catch (err) {
        console.error('Error en el login:', err);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/deposito', async (req, res) => {
    const { nombre, capacidad, direccion } = req.body;

    try {
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('capacidad', sql.Int, capacidad)
            .input('direccion', sql.VarChar, direccion)
            .query('INSERT INTO Depositos (Nombre, Capacidad_Maxima, Direccion) VALUES (@nombre, @capacidad, @direccion)');

        res.status(201).json({ message: 'Depósito registrado con éxito' });

    } catch (err) {
        console.error('Error al crear el depósito:', err);
        res.status(500).json({ message: 'Error interno del servidor al crear el depósito' });
    }
});

app.get('/api/usuarios', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .query('SELECT ID_Usuario, Nombre, Email, Rol FROM Usuarios');
            
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error al obtener usuarios:', err);
        res.status(500).json({ message: 'Error interno al cargar la lista de usuarios.' });
    }
});

app.put('/api/usuarios/:id/rol', async (req, res) => {
    const userId = req.params.id;
    const { nuevoRol } = req.body;

    try {
        let pool = await sql.connect(dbConfig);
        if (nuevoRol !== 'administrador') {
            const checkAdmins = await pool.request()
                .query("SELECT COUNT(*) AS total FROM Usuarios WHERE Rol = 'administrador'");
            
            if (checkAdmins.recordset[0].total <= 1) {
                const userActual = await pool.request()
                    .input('id', sql.Int, userId)
                    .query("SELECT Rol FROM Usuarios WHERE ID_Usuario = @id");

                if (userActual.recordset[0].Rol === 'administrador') {
                    return res.status(400).json({ message: 'Operación denegada. El sistema no puede quedarse sin administradores.' });
                }
            }
        }

        await pool.request()
            .input('rol', sql.VarChar, nuevoRol)
            .input('id', sql.Int, userId)
            .query('UPDATE Usuarios SET Rol = @rol WHERE ID_Usuario = @id');

        res.status(200).json({ message: 'Rol actualizado correctamente.' });
    } catch (err) {
        console.error('Error al cambiar rol:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        let pool = await sql.connect(dbConfig);

        const user = await pool.request()
            .input('id', sql.Int, userId)
            .query('SELECT Rol FROM Usuarios WHERE ID_Usuario = @id');

        if (user.recordset.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        await pool.request()
            .input('id', sql.Int, userId)
            .query('DELETE FROM Usuarios WHERE ID_Usuario = @id');

        res.status(200).json({ message: 'Usuario eliminado del sistema.' });
    } catch (err) {
        console.error('Error al eliminar usuario:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});
// Rutas de las vistas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de SGVI ejecutándose en http://localhost:${PORT}`);
});