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

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
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

    const formIngreso = document.getElementById('form-ingreso');
    if (formIngreso) {
        formIngreso.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Ingreso registrado (Simulación)');
            closeModal(document.getElementById('modal-ingreso'));
        });
    }

    const formRetiro = document.getElementById('form-retiro');
    if (formRetiro) {
        formRetiro.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Retiro registrado (Simulación)');
            closeModal(document.getElementById('modal-retiro'));
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