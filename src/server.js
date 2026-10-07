const express = require('express');
const path = require('path');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const SECRET_KEY = 'f56509c00a30fe0b194dd13034b168e807838f9306359d91d3dfe0d8b7d2d0466d2ada71c222e5e14085bd5725593effab96eb358626709549ebabff35aee4c6';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

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

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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

app.post('/api/vehiculos/add', upload.array('fotos', 5), async (req, res) => {
    const { patente, marca, modelo,nombreTitular,dniTitular, descripcion, motivo, fecha, idDeposito, idUsuario } = req.body;

    try {
        let pool = await sql.connect(dbConfig);

        const checkVehiculo = await pool.request()
            .input('patenteCheck', sql.VarChar, patente)
            .query("SELECT Estado_Actual FROM Vehiculos WHERE Patente = @patenteCheck AND Estado_Actual != 'Baja'");

        if (checkVehiculo.recordset.length > 0) {
            return res.status(400).json({ 
                message: `El vehículo con patente ${patente} ya se encuentra ingresado actualmente en un depósito.` 
            });
        }
        
        const resultVehiculo = await pool.request()
            .input('patente', sql.VarChar, patente)
            .input('marca', sql.VarChar, marca)
            .input('modelo', sql.VarChar, modelo)
            .input('titular', sql.VarChar, nombreTitular)
            .input('dni', sql.VarChar, dniTitular)
            .input('descripcion', sql.Text, descripcion)
            .input('motivo', sql.VarChar, motivo)
            .input('fecha', sql.Date, fecha)
            .input('id_deposito', sql.Int, idDeposito)
            .input('estado', sql.VarChar, 'Activo') 
            .query(`
                INSERT INTO Vehiculos 
                (Patente, Marca, Modelo, Nombre_Titular, DNI_Titular, Descripcion_Danos, Motivo_Incautacion, Fecha_Ingreso, ID_Deposito, Estado_Actual) 
                OUTPUT Inserted.ID_Vehiculo 
                VALUES (@patente, @marca, @modelo, @titular, @dni, @descripcion, @motivo, @fecha, @id_deposito, @estado)
            `);

        const idNuevoVehiculo = resultVehiculo.recordset[0].ID_Vehiculo;
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const rutaDestino = `/uploads/${req.files[i].filename}`;
                await pool.request()
                    .input('idVehiculo', sql.Int, idNuevoVehiculo)
                    .input('ruta', sql.VarChar, rutaDestino)
                    .query('INSERT INTO Fotos_Vehiculo (ID_Vehiculo, Ruta_Archivo) VALUES (@idVehiculo, @ruta)');
            }
        }

        await pool.request()
            .input('idVeh', sql.Int, idNuevoVehiculo)
            .input('idUsu', sql.Int, idUsuario)
            .input('idDep', sql.Int, idDeposito)
            .input('evento', sql.VarChar, 'Ingreso de Vehículo')
            .input('detalle', sql.Text, `Motivo original: ${motivo}`)
            .query('INSERT INTO Historial_Vehiculo (ID_Vehiculo, ID_Usuario, ID_Deposito, Fecha_Transaccion, Evento, Detalle_Extra) VALUES (@idVeh, @idUsu, @idDep, GETDATE(), @evento, @detalle)');
        
        res.status(201).json({ message: 'Vehículo ingresado con éxito' });
    } catch (err) {
        console.error('Error al ingresar vehículo:', err);
        res.status(500).json({ message: 'Error al registrar el vehículo.' });
    }
});

app.get('/api/vehiculos/detalle/:patente', async (req, res) => {
    const patente = req.params.patente;
    
    try {
        let pool = await sql.connect(dbConfig);
        
        const vehiculoResult = await pool.request()
            .input('patente', sql.VarChar, patente)
            .query("SELECT * FROM Vehiculos WHERE Patente = @patente AND Estado_Actual != 'Baja'");
            
        if (vehiculoResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Vehículo no encontrado.' });
        }
        
        const vehiculo = vehiculoResult.recordset[0];

        
        const fotosResult = await pool.request()
            .input('idVehiculo', sql.Int, vehiculo.ID_Vehiculo)
            .query("SELECT Ruta_Archivo FROM Fotos_Vehiculo WHERE ID_Vehiculo = @idVehiculo");
            

        const rutasEncontradas = fotosResult.recordset.map(f => Object.values(f)[0]);
        const respuestaFinal = {
            ...vehiculo,
            arrayFotos: rutasEncontradas
        };
        
        res.status(200).json(respuestaFinal);
    } catch (err) {
        console.error('Error al obtener detalle:', err);
        res.status(500).json({ message: 'Error al cargar los detalles.' });
    }
});

app.put('/api/vehiculos/:patente/estado', async (req, res) => {
    const patente = req.params.patente;
    const { nuevoEstado,idUsuario } = req.body;

    try {
        let pool = await sql.connect(dbConfig);

        const infoVehiculo = await pool.request()
            .input('patente', sql.VarChar, patente)
            .query("SELECT ID_Vehiculo, ID_Deposito FROM Vehiculos WHERE Patente = @patente AND Estado_Actual != 'Baja'");

        if (infoVehiculo.recordset.length === 0) return res.status(404).json({ message: 'Vehículo no encontrado.' });

        const { ID_Vehiculo, ID_Deposito } = infoVehiculo.recordset[0];


        
        await pool.request()
            .input('estado', sql.VarChar, nuevoEstado)
            .input('patente', sql.VarChar, patente)
            .query('UPDATE Vehiculos SET Estado_Actual = @estado WHERE Patente = @patente');

        await pool.request()
            .input('idVeh', sql.Int, ID_Vehiculo)
            .input('idUsu', sql.Int, idUsuario)
            .input('idDep', sql.Int, ID_Deposito)
            .input('evento', sql.VarChar, `Cambio a ${nuevoEstado}`)
            .query("INSERT INTO Historial_Vehiculo (ID_Vehiculo, ID_Usuario, ID_Deposito, Fecha_Transaccion, Evento) VALUES (@idVeh, @idUsu, @idDep, GETDATE(), @evento)");

        res.status(200).json({ message: 'Estado actualizado correctamente.' });
    } catch (err) {
        console.error('Error al actualizar estado del vehículo:', err);
        res.status(500).json({ message: 'Error interno al cambiar el estado.' });
    }
});

app.get('/api/vehiculos/:idDeposito', async (req, res) => {
    const idDeposito = req.params.idDeposito;

    try {
        let pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('id_deposito', sql.Int, idDeposito)
            .query("SELECT Patente, Marca, Modelo, Fecha_Ingreso, Estado_Actual FROM Vehiculos WHERE ID_Deposito = @id_deposito AND Estado_Actual != 'Baja'");
            
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error al obtener vehículos:', err);
        res.status(500).json({ message: 'Error al cargar el dashboard.' });
    }
});

app.get('/api/depositos/:id/stats', async (req, res) => {
    const idDeposito = req.params.id;

    try {
        let pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('id', sql.Int, idDeposito)
            .query(`
                SELECT 
                    d.Capacidad_Maxima,
                    (SELECT COUNT(*) FROM Vehiculos v WHERE v.ID_Deposito = d.ID_Deposito AND v.Estado_Actual IN ('Activo', 'Remate')) AS Ocupados
                FROM Depositos d
                WHERE d.ID_Deposito = @id
            `);
            
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Depósito no encontrado' });
        }
        
        const stats = result.recordset[0];
        res.status(200).json({
            totales: stats.Capacidad_Maxima,
            ocupados: stats.Ocupados,
            libres: stats.Capacidad_Maxima - stats.Ocupados // Acá hacemos la resta directamente en el servidor
        });

    } catch (err) {
        console.error('Error al calcular capacidad:', err);
        res.status(500).json({ message: 'Error interno al cargar estadísticas.' });
    }
});

app.post('/api/vehiculos/retiro', async (req, res) => {
    const { patente, motivo, retiranteNombre, retiranteDni, esTitular, resolucion, idUsuario } = req.body;

    try {
        let pool = await sql.connect(dbConfig);
        
        const checkVehiculo = await pool.request()
            .input('patente', sql.VarChar, patente)
            .query("SELECT ID_Vehiculo, ID_Deposito FROM Vehiculos WHERE Patente = @patente AND Estado_Actual != 'Baja'");

            
        if (checkVehiculo.recordset.length === 0) {
            return res.status(404).json({ message: 'Vehículo no encontrado o ya fue dado de baja previamente.' });
        }

        const { ID_Vehiculo, ID_Deposito } = checkVehiculo.recordset[0];
        
        await pool.request()
            .input('patente', sql.VarChar, patente)
            .input('estado', sql.VarChar, 'Baja')
            .query("UPDATE Vehiculos SET Estado_Actual = @estado WHERE Patente = @patente");


        const nombreEvento = motivo === 'venta' ? 'Baja por Venta/Remate' : 'Baja por Devolución';
        const detalleExtra = `Retirado por: ${retiranteNombre} (DNI: ${retiranteDni}). Resolución/Expediente: ${resolucion}`;

        await pool.request()
            .input('idVeh', sql.Int, ID_Vehiculo)
            .input('idUsu', sql.Int, idUsuario)
            .input('idDep', sql.Int, ID_Deposito)
            .input('evento', sql.VarChar, nombreEvento)
            .input('detalle', sql.Text, detalleExtra)
            .query("INSERT INTO Historial_Vehiculo (ID_Vehiculo, ID_Usuario, ID_Deposito, Fecha_Transaccion, Evento, Detalle_Extra) VALUES (@idVeh, @idUsu, @idDep, GETDATE(), @evento, @detalle)");

        res.status(200).json({ message: 'Vehículo dado de baja exitosamente.' });

    } catch (err) {
        console.error('Error al registrar la baja:', err);
        res.status(500).json({ message: 'Error interno del servidor al procesar la salida.' });
    }
});

app.get('/api/historial/:idDeposito', async (req, res) => {
    const idDeposito = req.params.idDeposito;

    try {
        let pool = await sql.connect(dbConfig);
        let result;

        const baseQuery = `
            SELECT 
                h.Fecha_Transaccion, 
                v.Patente, 
                h.Evento, 
                u.Nombre AS Usuario, 
                h.Detalle_Extra,
                d.Nombre AS NombreDeposito
            FROM Historial_Vehiculo h
            JOIN Vehiculos v ON h.ID_Vehiculo = v.ID_Vehiculo
            JOIN Usuarios u ON h.ID_Usuario = u.ID_Usuario
            JOIN Depositos d ON h.ID_Deposito = d.ID_Deposito
        `;

        if (idDeposito == 0) {
            result = await pool.request()
                .query(baseQuery + ` ORDER BY h.Fecha_Transaccion DESC`);
        } else {
            result = await pool.request()
                .input('idDep', sql.Int, idDeposito)
                .query(baseQuery + ` WHERE h.ID_Deposito = @idDep ORDER BY h.Fecha_Transaccion DESC`);
        }
            
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error al cargar historial:', err);
        res.status(500).json({ message: 'Error interno al cargar la bitácora.' });
    }
});
// Rutas de las vistas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de SGVI ejecutándose en http://localhost:${PORT}`);
});