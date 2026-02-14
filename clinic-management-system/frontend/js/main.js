// Authentication check
const token = localStorage.getItem('token');
const doctor = JSON.parse(localStorage.getItem('doctor') || '{}');

if (!token && window.location.pathname.includes('dashboard.html')) {
    window.location.href = '/login.html';
}

// Display doctor info
if (doctor.name) {
    const doctorInfo = document.getElementById('doctorInfo');
    if (doctorInfo) {
        doctorInfo.innerHTML = `
            <h4>د. ${doctor.name}</h4>
            <p>${doctor.specialization || 'طبيب'}</p>
        `;
    }
}

// Current date display
const currentDate = document.getElementById('currentDate');
if (currentDate) {
    const now = new Date();
    currentDate.textContent = now.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Navigation
function showSection(sectionId) {
    // Update active link
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Show selected section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${sectionId}-section`).classList.add('active');
    
    // Load section data
    if (sectionId === 'dashboard') loadDashboard();
    if (sectionId === 'patients') loadPatients();
    if (sectionId === 'appointments') loadAppointments();
    if (sectionId === 'reports') loadReports();
}

// API calls
async function apiCall(url, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!response.ok) {
        throw new Error(result.error || 'حدث خطأ في الاتصال');
    }
    
    return result;
}

// Dashboard
async function loadDashboard() {
    try {
        const stats = await apiCall('/api/dashboard/stats');
        const statsGrid = document.getElementById('dashboardStats');
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="stat-info">
                    <h3>${stats.totalPatients}</h3>
                    <p>إجمالي المرضى</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-calendar-check"></i>
                </div>
                <div class="stat-info">
                    <h3>${stats.totalAppointments}</h3>
                    <p>إجمالي المواعيد</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-calendar-day"></i>
                </div>
                <div class="stat-info">
                    <h3>${stats.todayAppointments}</h3>
                    <p>مواعيد اليوم</p>
                </div>
            </div>
        `;
        
        // Load recent appointments
        const appointments = await apiCall('/api/appointments');
        const tbody = document.querySelector('#recentAppointments tbody');
        tbody.innerHTML = appointments.slice(0, 5).map(apt => `
            <tr>
                <td>${apt.patientId?.name || 'غير محدد'}</td>
                <td>${new Date(apt.date).toLocaleDateString('ar-EG')}</td>
                <td>${apt.time}</td>
                <td>
                    <span class="status-badge ${apt.status}">
                        ${apt.status === 'scheduled' ? 'مجدول' : 
                          apt.status === 'completed' ? 'مكتمل' : 'ملغي'}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Patients
async function loadPatients() {
    try {
        const patients = await apiCall('/api/patients');
        const tbody = document.querySelector('#patientsTable tbody');
        tbody.innerHTML = patients.map(patient => `
            <tr>
                <td>${patient.name}</td>
                <td>${patient.age}</td>
                <td>${patient.gender}</td>
                <td>${patient.phone}</td>
                <td>${patient.email || '-'}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editPatient('${patient._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deletePatient('${patient._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

function showPatientModal() {
    document.getElementById('patientModal').classList.add('show');
}

function closePatientModal() {
    document.getElementById('patientModal').classList.remove('show');
    document.getElementById('patientForm').reset();
    document.getElementById('patientId').value = '';
}

async function savePatient(event) {
    event.preventDefault();
    
    const patientData = {
        name: document.getElementById('patientName').value,
        age: document.getElementById('patientAge').value,
        gender: document.getElementById('patientGender').value,
        phone: document.getElementById('patientPhone').value,
        email: document.getElementById('patientEmail').value,
        address: document.getElementById('patientAddress').value,
        medicalHistory: document.getElementById('patientMedicalHistory').value
    };
    
    const patientId = document.getElementById('patientId').value;
    
    try {
        if (patientId) {
            await apiCall(`/api/patients/${patientId}`, 'PUT', patientData);
        } else {
            await apiCall('/api/patients', 'POST', patientData);
        }
        
        closePatientModal();
        loadPatients();
    } catch (error) {
        alert(error.message);
    }
}

async function editPatient(id) {
    try {
        const patients = await apiCall('/api/patients');
        const patient = patients.find(p => p._id === id);
        
        if (patient) {
            document.getElementById('patientId').value = patient._id;
            document.getElementById('patientName').value = patient.name;
            document.getElementById('patientAge').value = patient.age;
            document.getElementById('patientGender').value = patient.gender;
            document.getElementById('patientPhone').value = patient.phone;
            document.getElementById('patientEmail').value = patient.email || '';
            document.getElementById('patientAddress').value = patient.address || '';
            document.getElementById('patientMedicalHistory').value = patient.medicalHistory || '';
            
            showPatientModal();
        }
    } catch (error) {
        alert(error.message);
    }
}

async function deletePatient(id) {
    if (confirm('هل أنت متأكد من حذف هذا المريض؟')) {
        try {
            await apiCall(`/api/patients/${id}`, 'DELETE');
            loadPatients();
        } catch (error) {
            alert(error.message);
        }
    }
}

function searchPatients() {
    const searchText = document.getElementById('patientSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#patientsTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchText) ? '' : 'none';
    });
}

// Appointments
async function loadAppointments() {
    try {
        const appointments = await apiCall('/api/appointments');
        const tbody = document.querySelector('#appointmentsTable tbody');
        tbody.innerHTML = appointments.map(apt => `
            <tr>
                <td>${apt.patientId?.name || 'غير محدد'}</td>
                <td>${new Date(apt.date).toLocaleDateString('ar-EG')}</td>
                <td>${apt.time}</td>
                <td>
                    <span class="status-badge ${apt.status}">
                        ${apt.status === 'scheduled' ? 'مجدول' : 
                          apt.status === 'completed' ? 'مكتمل' : 'ملغي'}
                    </span>
                </td>
                <td>${apt.notes || '-'}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editAppointment('${apt._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteAppointment('${apt._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading appointments:', error);
    }
}

async function showAppointmentModal() {
    // Load patients for dropdown
    try {
        const patients = await apiCall('/api/patients');
        const select = document.getElementById('appointmentPatientId');
        select.innerHTML = '<option value="">اختر مريض</option>' + 
            patients.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
        
        document.getElementById('appointmentModal').classList.add('show');
    } catch (error) {
        alert(error.message);
    }
}

function closeAppointmentModal() {
    document.getElementById('appointmentModal').classList.remove('show');
    document.getElementById('appointmentForm').reset();
    document.getElementById('appointmentId').value = '';
}

async function saveAppointment(event) {
    event.preventDefault();
    
    const appointmentData = {
        patientId: document.getElementById('appointmentPatientId').value,
        date: document.getElementById('appointmentDate').value,
        time: document.getElementById('appointmentTime').value,
        notes: document.getElementById('appointmentNotes').value,
        status: 'scheduled'
    };
    
    const appointmentId = document.getElementById('appointmentId').value;
    
    try {
        if (appointmentId) {
            await apiCall(`/api/appointments/${appointmentId}`, 'PUT', appointmentData);
        } else {
            await apiCall('/api/appointments', 'POST', appointmentData);
        }
        
        closeAppointmentModal();
        loadAppointments();
        loadDashboard();
    } catch (error) {
        alert(error.message);
    }
}

async function editAppointment(id) {
    try {
        const appointments = await apiCall('/api/appointments');
        const appointment = appointments.find(a => a._id === id);
        
        if (appointment) {
            // Load patients for dropdown
            const patients = await apiCall('/api/patients');
            const select = document.getElementById('appointmentPatientId');
            select.innerHTML = '<option value="">اختر مريض</option>' + 
                patients.map(p => `<option value="${p._id}" ${p._id === appointment.patientId?._id ? 'selected' : ''}>${p.name}</option>`).join('');
            
            document.getElementById('appointmentId').value = appointment._id;
            document.getElementById('appointmentDate').value = appointment.date.split('T')[0];
            document.getElementById('appointmentTime').value = appointment.time;
            document.getElementById('appointmentNotes').value = appointment.notes || '';
            
            showAppointmentModal();
        }
    } catch (error) {
        alert(error.message);
    }
}

async function deleteAppointment(id) {
    if (confirm('هل أنت متأكد من حذف هذا الموعد؟')) {
        try {
            await apiCall(`/api/appointments/${id}`, 'DELETE');
            loadAppointments();
            loadDashboard();
        } catch (error) {
            alert(error.message);
        }
    }
}

// Reports
async function loadReports() {
    try {
        const patients = await apiCall('/api/patients');
        const appointments = await apiCall('/api/appointments');
        
        // Patients chart
        const patientsByGender = {
            ذكر: patients.filter(p => p.gender === 'ذكر').length,
            أنثى: patients.filter(p => p.gender === 'أنثى').length
        };
        
        new Chart(document.getElementById('patientsChart'), {
            type: 'pie',
            data: {
                labels: ['ذكور', 'إناث'],
                datasets: [{
                    data: [patientsByGender.ذكر, patientsByGender.أنثى],
                    backgroundColor: ['#2a9d8f', '#e9c46a']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
        
        // Appointments chart
        const appointmentsByStatus = {
            scheduled: appointments.filter(a => a.status === 'scheduled').length,
            completed: appointments.filter(a => a.status === 'completed').length,
            cancelled: appointments.filter(a => a.status === 'cancelled').length
        };
        
        new Chart(document.getElementById('appointmentsChart'), {
            type: 'bar',
            data: {
                labels: ['مجدول', 'مكتمل', 'ملغي'],
                datasets: [{
                    label: 'عدد المواعيد',
                    data: [appointmentsByStatus.scheduled, appointmentsByStatus.completed, appointmentsByStatus.cancelled],
                    backgroundColor: ['#2a9d8f', '#e9c46a', '#e76f51']
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        stepSize: 1
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('doctor');
    window.location.href = '/login.html';
}

// Initialize on page load
if (window.location.pathname.includes('dashboard.html')) {
    loadDashboard();
    loadPatients();
    loadAppointments();
}
