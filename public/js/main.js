document.addEventListener('DOMContentLoaded', () => {

    const token = localStorage.getItem('sgvi_token');

    // Si no hay token, lo pateamos al login
    if (!token) {
        window.location.href = '/';
        return;
    }

    let usuarioLogueado;
    try {
        // Decodificamos el JWT para sacar el rol y el nombre
        const payloadBase64 = token.split('.')[1];
        usuarioLogueado = JSON.parse(atob(payloadBase64));
    } catch (error) {
        console.error('Error al leer el token de sesión', error);
        localStorage.removeItem('sgvi_token');
        window.location.href = '/';
        return;
    }

    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        const rolFormateado = usuarioLogueado.rol.charAt(0).toUpperCase() + usuarioLogueado.rol.slice(1);
        const depositoSeleccionado = localStorage.getItem('sgvi_deposito_nombre') || 'Depósito no asignado';
        userInfo.textContent = `${rolFormateado} - ${depositoSeleccionado}`;
    }

    // Ocultamos el botón de Administración si es operario
    const btnAdmin = document.querySelector('button[data-target="vista-admin-usuarios"]');
    if (btnAdmin && usuarioLogueado.rol !== 'administrador') {
        btnAdmin.style.display = 'none';
    }

    // ==========================================
    // 1. NAVEGACIÓN LATERAL (Dashboard vs Historial)
    // ==========================================
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);

            if (!targetSection) {
                console.warn(`No se encontró la sección con ID: ${targetId}`);
                return;
            }

            // Desactivar botones y ocultar todas las vistas
            navBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.add('hidden'));

            // Activar el botón presionado y mostrar la sección correspondiente
            btn.classList.add('active');
            targetSection.classList.remove('hidden');

            if (targetId === 'vista-admin-usuarios') {
                cargarListaUsuarios();
            }
        });
    });

    cargarVehiculos();
    cargarEstadisticas();
    // ==========================================
    // 2. CONTROL DE MODALES (Popups)
    // ==========================================
    const openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('hidden');
    };

    const closeModal = (modalElement) => {
        if (!modalElement) return;
        modalElement.classList.add('hidden');
        const form = modalElement.querySelector('form');
        if (form) form.reset();
    };

    // Botones que disparan modales (con chequeo para no romper si alguno no existe)
    const btnIngreso = document.getElementById('btn-open-ingreso');
    const btnRetiro = document.getElementById('btn-open-retiro');
    const btnExportar = document.getElementById('btn-open-exportar');
    const btnRegistro = document.getElementById('btn-open-registro');
    const btnDeposito = document.getElementById('btn-open-deposito');

    if (btnIngreso) btnIngreso.addEventListener('click', () => openModal('modal-ingreso'));
    if (btnRetiro) btnRetiro.addEventListener('click', () => openModal('modal-retiro'));
    if (btnExportar) btnExportar.addEventListener('click', () => openModal('modal-exportar'));
    if (btnRegistro) btnRegistro.addEventListener('click', () => openModal('modal-registro'));
    if (btnDeposito) btnDeposito.addEventListener('click', () => openModal('modal-deposito'));

    // Configuración para cerrar modales (cruz y fondo oscuro)
    document.querySelectorAll('.modal').forEach(modal => {
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeModal(modal));
        }
    });

    const formDepositoNuevo = document.getElementById('form-deposito-nuevo');
    if (formDepositoNuevo) {
        formDepositoNuevo.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombre = document.getElementById('dep-nombre').value;
            const capacidad = document.getElementById('dep-capacidad').value;
            const direccion = document.getElementById('dep-direccion').value;

            try {
                const response = await fetch('/api/deposito', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, capacidad, direccion })
                });

                if (response.ok) {
                    alert('Depósito creado con éxito.');
                    closeModal(document.getElementById('modal-deposito'));
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.message}`);
                }
            } catch (error) {
                console.error('Error de red al crear depósito:', error);
                alert('Hubo un problema al conectar con el servidor.');
            }
        });
    }

    const inputPatente = document.getElementById('ing-patente');
    if (inputPatente) {
        inputPatente.addEventListener('input', function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
    }

    const inputDni = document.getElementById('ing-dni');
    if (inputDni) {
        inputDni.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    const inputBajaPatente = document.getElementById('baja-patente-busqueda');
    if (inputBajaPatente) {
        inputBajaPatente.addEventListener('input', function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
    }

    const selectMarca = document.getElementById('ing-marca');
    const inputModelo = document.getElementById('ing-modelo');

    if (selectMarca && inputModelo) {
        selectMarca.addEventListener('change', (e) => {
            if (e.target.value === 'Otra') {
                inputModelo.placeholder = "Ej: Ferrari Enzo";
            } else {
                inputModelo.placeholder = ""; 
            }
        });
    }
    if (inputModelo) {
        inputModelo.addEventListener('input', function() {
            this.value = this.value.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
        });
    }

    const formIngreso = document.getElementById('form-ingreso');
    if (formIngreso) {
        formIngreso.addEventListener('submit', async(e) => {
            e.preventDefault();
            const patente = document.getElementById('ing-patente').value;
            const marca = document.getElementById('ing-marca').value;
            const modelo = document.getElementById('ing-modelo').value;
            const nombreTitular = document.getElementById('ing-titular').value;
            const dniTitular = document.getElementById('ing-dni').value;
            const descripcion = document.getElementById('ing-desc').value;
            const motivo = document.getElementById('ing-motivo').value;
            const fecha = document.getElementById('ing-fecha').value;
            const idDeposito = localStorage.getItem('sgvi_deposito_id'); 

            if (patente.length < 6) {
                alert('La patente debe tener al menos 6 caracteres (ej: AAA111 o AB123CD).');
                return;
            }
            if (dniTitular.length < 7) {
                alert('El DNI ingresado es demasiado corto.');
                return; 
            }
            console.log('Datos a enviar:', { patente, marca, modelo, nombreTitular, dniTitular, descripcion, motivo, fecha, idDeposito });

            const formData = new FormData();
            formData.append('patente', patente);
            formData.append('marca', marca);
            formData.append('modelo', modelo);
            formData.append('nombreTitular', nombreTitular);
            formData.append('dniTitular', dniTitular);
            formData.append('descripcion', descripcion);
            formData.append('motivo', motivo);
            formData.append('fecha', fecha);
            formData.append('idDeposito', idDeposito);

            const inputFotos = document.getElementById('ing-fotos');
            if (inputFotos && inputFotos.files.length > 0) {
                for (let i = 0; i < inputFotos.files.length; i++) {
                    formData.append('fotos', inputFotos.files[i]); 
                }
            }

            try {
                const response = await fetch('/api/vehiculos/add', {
                    method: 'POST',
                    body: formData 
                });

                if (response.ok) {
                    alert('Vehículo ingresado exitosamente al depósito.');
                    closeModal(document.getElementById('modal-ingreso'));
                    cargarVehiculos(); // Recargamos el dashboard automáticamente
                    cargarEstadisticas();
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.message}`);
                }
            } catch (err) {
                console.error(err);
                alert('Hubo un problema de conexión al registrar el vehículo.');
            }
        });
    }

    const formRetiro = document.getElementById('form-retiro');
    if (formRetiro) {
        formRetiro.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const inputPatenteBaja = document.getElementById('baja-patente-busqueda');
            const patente = inputPatenteBaja ? inputPatenteBaja.value.trim().toUpperCase() : '';
            
            if (!patente) {
                alert('Por favor, ingresá la patente del vehículo a dar de baja.');
                return;
            }

            const motivo = document.getElementById('baja-motivo').value;
            const retiranteNombre = document.getElementById('baja-nombre').value;
            const retiranteDni = document.getElementById('baja-dni').value;
            const esTitular = document.getElementById('es-titular').checked;
            const resolucion = document.getElementById('baja-resolucion').value;

            try {
                const response = await fetch('/api/vehiculos/retiro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ patente, motivo, retiranteNombre, retiranteDni, esTitular, resolucion })
                });

                if (response.ok) {
                    alert('Salida de vehículo registrada con éxito.');
                    closeModal(document.getElementById('modal-retiro'));

                    cargarVehiculos(); 
                    cargarEstadisticas(); 
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.message}`);
                }
            } catch (err) {
                console.error('Error en la baja:', err);
                alert('Hubo un problema de conexión al registrar la salida del vehículo.');
            }
        });
    }

    async function cargarListaUsuarios() {
        const tbody = document.querySelector('#vista-admin-usuarios .data-table tbody');

        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Cargando usuarios desde la base de datos...</td></tr>';
        } else {
            console.error("No se encontró la tabla de usuarios");
            return;
        }

        try {
            const response = await fetch('/api/usuarios');

            if (response.ok) {
                const usuarios = await response.json();
                tbody.innerHTML = '';
                const rolesDisponibles = ['operario', 'administrador'];

                usuarios.forEach(user => {
                    const tr = document.createElement('tr');

                    const opcionesHTML = rolesDisponibles.map(rol => {
                        const seleccionado = user.Rol === rol ? 'selected' : '';
                        const nombreMostrar = rol.charAt(0).toUpperCase() + rol.slice(1);

                        return `<option value="${rol}" ${seleccionado}>${nombreMostrar}</option>`;
                    }).join('');

                    const botonEliminarHTML = user.Rol === 'administrador'
                        ? '<span style="color: #7f8c8d; font-size: 13px;">No eliminable</span>'
                        : `<button class="btn-secondary btn-eliminar-usuario" data-id="${user.ID_Usuario}" style="padding: 6px 10px; font-size: 13px; background-color: #e74c3c;">Eliminar</button>`;

                    tr.innerHTML = `
                        <td><strong>${user.Nombre}</strong></td>
                        <td>${user.Email}</td>
                        <td>
                            <select class="status-selector select-rol" data-id="${user.ID_Usuario}">
                                ${opcionesHTML}
                            </select>
                        </td>
                        <td>
                            ${botonEliminarHTML}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#e74c3c; padding: 20px;">Error del servidor: ${response.status}</td></tr>`;
            }
        } catch (error) {
            console.error('Error de red al cargar usuarios:', error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#e74c3c; padding: 20px;">No se pudo conectar con el servidor.</td></tr>';
        }
    }

    async function cargarVehiculos() {
        const tbody = document.querySelector('#vista-monitor .data-table tbody');
        if (!tbody) return;

        const idDeposito = localStorage.getItem('sgvi_deposito_id');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando vehículos...</td></tr>';

        try {
            const response = await fetch(`/api/vehiculos/${idDeposito}`);
            
            if (response.ok) {
                const vehiculos = await response.json();
                tbody.innerHTML = ''; 

                if (vehiculos.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay vehículos activos en este depósito.</td></tr>';
                    return;
                }

                vehiculos.forEach(v => {
                    const fechaObj = new Date(v.Fecha_Ingreso);
                    const fechaLocal = fechaObj.toLocaleDateString('es-AR', { timeZone: 'UTC' });

                    let bgColor = '';
                    let textColor = 'black'; 

                    if (v.Estado_Actual === 'Activo') {
                        bgColor = '#2ecc71'; 
                        textColor = 'white'; 
                    } else if (v.Estado_Actual === 'Remate') {
                        bgColor = '#f1c40f'; 
                        textColor = 'black'; 
                    }

                    const textMarca = v.Marca === 'Otra' ? v.Modelo : `${v.Marca} ${v.Modelo}`;

                    const tr = document.createElement('tr');
                    tr.setAttribute('data-marca', v.Marca);
                    tr.innerHTML = `
                        <td><strong>${v.Patente}</strong></td>
                        <td>${textMarca}</td>
                        <td>${fechaLocal}</td>
                        <td>
                            <select class="status-selector select-estado-vehiculo" data-patente="${v.Patente}" style="background-color: ${bgColor}; color: ${textColor}; font-weight: bold; border: 1px solid #ccc; padding: 4px; border-radius: 4px;">
                                <option value="Activo" ${v.Estado_Actual === 'Activo' ? 'selected' : ''} >Activo en Depósito</option>
                                <option value="Remate" ${v.Estado_Actual === 'Remate' ? 'selected' : ''} >Enviado a Remate</option>
                            </select>
                        </td>
                        <td><button class="btn-secondary btn-ver-detalle" data-patente="${v.Patente}" style="padding: 6px 10px; font-size: 13px;">Ver Detalle</button></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error al cargar datos.</td></tr>';
        }
    }

    async function cargarEstadisticas() {
        const idDeposito = localStorage.getItem('sgvi_deposito_id');
        if (!idDeposito) return;

        try {
            const response = await fetch(`/api/depositos/${idDeposito}/stats`);
            
            if (response.ok) {
                const stats = await response.json();
                
                document.getElementById('stat-totales').textContent = stats.totales;
                document.getElementById('stat-ocupados').textContent = stats.ocupados;
                document.getElementById('stat-libres').textContent = stats.libres;
                
                if (stats.libres <= 5) {
                    document.getElementById('stat-libres').style.color = '#e74c3c'; 
                } else {
                    document.getElementById('stat-libres').style.color = '';
                }
            }
        } catch (error) {
            console.error('Error al cargar la capacidad del depósito', error);
        }
    }

    const tbodyMonitor = document.querySelector('#vista-monitor .data-table tbody');
    if (tbodyMonitor) {
        tbodyMonitor.addEventListener('change', async (e) => {
            if (e.target.classList.contains('select-estado-vehiculo')) {
                const selectElement = e.target;
                const nuevoEstado = selectElement.value;
                const patente = selectElement.getAttribute('data-patente');

                selectElement.classList.remove('estado-activo', 'estado-remate');
                if (nuevoEstado === 'Activo') {
                    selectElement.classList.add('estado-activo');
                } else if (nuevoEstado === 'Remate') {
                    selectElement.classList.add('estado-remate');
                }
                try {
                    const res = await fetch(`/api/vehiculos/${patente}/estado`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nuevoEstado })
                    });

                    const data = await res.json();
                    
                    if (!res.ok) {
                        alert(`Error: ${data.message}`);
                        cargarVehiculos(); 
                    } else {
                        cargarEstadisticas(); 
                    }
                } catch (err) {
                    alert('Error de conexión al intentar cambiar el estado en el servidor.');
                    cargarVehiculos(); 
                }

            }
        });
    }

    const tbodyAdmin = document.querySelector('#vista-admin-usuarios .data-table tbody');
    
    if (tbodyAdmin) {
        // Evento para cambiar rol
        tbodyAdmin.addEventListener('change', async (e) => {
            if (e.target.classList.contains('select-rol')) {
                const selectElement = e.target;
                const userId = selectElement.getAttribute('data-id');
                const nuevoRol = selectElement.value;
                const rolAnterior = selectElement.getAttribute('data-current-rol'); // Asumiendo que agregaste esto en el HTML

                if (confirm(`¿Estás seguro que deseas asignarle a este usuario el rol: ${nuevoRol}?`)) {
                    try {
                        const res = await fetch(`/api/usuarios/${userId}/rol`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ nuevoRol })
                        });

                        const data = await res.json();
                        if (!res.ok) {
                            alert(`Error: ${data.message}`);
                            cargarListaUsuarios();
                        } else {
                            console.log(data.message);
                            cargarListaUsuarios();
                        }
                    } catch (err) {
                        alert('Error al intentar cambiar el rol.');
                        cargarListaUsuarios();
                    }
                } else {
                    // Si cancela, volvemos a cargar para revertir visualmente
                    cargarListaUsuarios(); 
                }
            }
        });

        // Evento para eliminar usuario
        tbodyAdmin.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-eliminar-usuario')) {
                const userId = e.target.getAttribute('data-id');

                if (confirm('¿Estás seguro de que deseás eliminar este usuario?')) {
                    try {
                        const res = await fetch(`/api/usuarios/${userId}`, { method: 'DELETE' });
                        const data = await res.json();

                        if (res.ok) {
                            cargarListaUsuarios();
                        } else {
                            alert(`Error: ${data.message}`);
                        }
                    } catch (err) {
                        alert('Error al intentar eliminar el usuario.');
                    }
                }
                else {  
                    cargarListaUsuarios(); 
                }
            }
        });
    }

    const buscadorPatente = document.getElementById('buscador-patente');
    const filtroMarca = document.getElementById('filtro-marca');

    function aplicarFiltros() {
        const textoPatente = buscadorPatente ? buscadorPatente.value.toLowerCase().trim() : '';
        const marcaSeleccionada = filtroMarca ? filtroMarca.value : '';

        const filas = document.querySelectorAll('#vista-monitor .data-table tbody tr');

        filas.forEach(fila => {
            if (fila.children.length <= 1) return; 

            const patenteFila = fila.children[0].textContent.toLowerCase();
            const marcaFila = fila.getAttribute('data-marca'); 

            const coincidePatente = patenteFila.includes(textoPatente);
            const coincideMarca = marcaSeleccionada === '' || marcaFila === marcaSeleccionada;

            if (coincidePatente && coincideMarca) {
                fila.style.display = '';
            } else {
                fila.style.display = 'none';
            }
        });
    }

    if (buscadorPatente) {
        buscadorPatente.addEventListener('input', aplicarFiltros);
    }
    if (filtroMarca) {
        filtroMarca.addEventListener('change', aplicarFiltros);
    }


    //Modal Dinamico de retiro
    const bajaMotivo = document.getElementById('baja-motivo');
    const grupoTitular = document.getElementById('grupo-titular');
    const labelRetirante = document.getElementById('label-retirante');
    const labelResolucion = document.getElementById('label-resolucion');
    const checkboxTitular = document.getElementById('es-titular');

    if (bajaMotivo) {
        bajaMotivo.addEventListener('change', (e) => {
            if (e.target.value === 'venta') {
                grupoTitular.style.display = 'none';
                checkboxTitular.checked = false;
                labelRetirante.textContent = 'Nombre del comprador';
                labelResolucion.textContent = 'Nº de Expediente / Acta de Remate';
            } else {
                grupoTitular.style.display = 'flex';
                labelRetirante.textContent = 'Nombre de quien retira';
                labelResolucion.textContent = 'Resolución de la infracción (Nº de comprobante)';
            }
        });
    }

    
    const modalDetalle = document.getElementById('modal-detalle');
    
    if (modalDetalle) {
        const closeBtnDetalle = modalDetalle.querySelector('.close-btn');
        if (closeBtnDetalle) {
            closeBtnDetalle.addEventListener('click', () => closeModal(modalDetalle));
        }
    }

    if (tbodyMonitor) {
        tbodyMonitor.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-ver-detalle')) {
                const patente = e.target.getAttribute('data-patente');
                
                try {
                    const response = await fetch(`/api/vehiculos/detalle/${patente}`);
                    if (response.ok) {
                        const v = await response.json();
                        
                        const fechaLocal = new Date(v.Fecha_Ingreso).toLocaleDateString('es-AR', { timeZone: 'UTC' });
                        const textMarca = v.Marca === 'Otra' ? v.Modelo : `${v.Marca} ${v.Modelo}`;

                        document.getElementById('det-titulo').textContent = `${patente} - ${textMarca}`;
                        document.getElementById('det-titular').textContent = v.Nombre_Titular || 'N/A';
                        document.getElementById('det-dni').textContent = v.DNI_Titular || 'N/A';
                        document.getElementById('det-fecha').textContent = fechaLocal;
                        document.getElementById('det-motivo').textContent = v.Motivo_Incautacion || 'N/A';
                        document.getElementById('det-desc').textContent = v.Descripcion_Danos || 'Sin descripción';

                        const galeria = document.getElementById('det-galeria');
                        galeria.innerHTML = ''; 
                        
                        if (v.arrayFotos && v.arrayFotos.length > 0) {
                            v.arrayFotos.forEach(ruta => {
                                const img = document.createElement('img');
                                console.log('Cargando imagen:', ruta);
                                img.src = ruta;
                                img.style.height = '120px';
                                img.style.borderRadius = '5px';
                                img.style.objectFit = 'cover';
                                galeria.appendChild(img);
                            });
                        } else {
                            galeria.innerHTML = '<p style="color:#7f8c8d; font-style: italic;">No hay fotografías registradas.</p>';
                        }

                        openModal('modal-detalle');
                    } else {
                        alert('No se pudieron cargar los detalles.');
                    }
                } catch (err) {
                    console.error('Error al abrir detalle:', err);
                }
            }
        });
    }
    
    // ==========================================
    // 3. CERRAR SESIÓN
    // ==========================================
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            window.location.href = '/';
        });
    }
});