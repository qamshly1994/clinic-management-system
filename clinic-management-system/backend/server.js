const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Doctor Schema
const doctorSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    specialization: String,
    email: String,
    phone: String,
    createdAt: { type: Date, default: Date.now }
});

// Patient Schema
const patientSchema = new mongoose.Schema({
    name: String,
    age: Number,
    gender: String,
    phone: String,
    email: String,
    address: String,
    medicalHistory: String,
    createdAt: { type: Date, default: Date.now }
});

// Appointment Schema
const appointmentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    date: Date,
    time: String,
    status: { type: String, default: 'scheduled' },
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

const Doctor = mongoose.model('Doctor', doctorSchema);
const Patient = mongoose.model('Patient', patientSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Routes

// Register Doctor (للاستخدام مرة واحدة فقط - إنشاء الأطباء)
app.post('/api/register-doctor', async (req, res) => {
    try {
        const { username, password, name, specialization, email, phone } = req.body;
        
        // Check if doctor exists
        const existingDoctor = await Doctor.findOne({ username });
        if (existingDoctor) {
            return res.status(400).json({ error: 'Doctor already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new doctor
        const doctor = new Doctor({
            username,
            password: hashedPassword,
            name,
            specialization,
            email,
            phone
        });
        
        await doctor.save();
        res.status(201).json({ message: 'Doctor created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find doctor
        const doctor = await Doctor.findOne({ username });
        if (!doctor) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, doctor.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create token
        const token = jwt.sign(
            { id: doctor._id, username: doctor.username },
            process.env.JWT_SECRET || 'secret123',
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            doctor: {
                id: doctor._id,
                name: doctor.name,
                username: doctor.username,
                specialization: doctor.specialization
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Middleware to verify token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'secret123', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Patients CRUD
app.get('/api/patients', authenticateToken, async (req, res) => {
    try {
        const patients = await Patient.find().sort({ createdAt: -1 });
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/patients', authenticateToken, async (req, res) => {
    try {
        const patient = new Patient(req.body);
        await patient.save();
        res.status(201).json(patient);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const patient = await Patient.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        await Patient.findByIdAndDelete(req.params.id);
        res.json({ message: 'Patient deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Appointments CRUD
app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const appointments = await Appointment.find()
            .populate('patientId')
            .sort({ date: -1 });
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const appointment = new Appointment({
            ...req.body,
            doctorId: req.user.id
        });
        await appointment.save();
        res.status(201).json(appointment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/appointments/:id', authenticateToken, async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(appointment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/appointments/:id', authenticateToken, async (req, res) => {
    try {
        await Appointment.findByIdAndDelete(req.params.id);
        res.json({ message: 'Appointment deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const totalPatients = await Patient.countDocuments();
        const totalAppointments = await Appointment.countDocuments();
        const todayAppointments = await Appointment.countDocuments({
            date: {
                $gte: new Date().setHours(0, 0, 0),
                $lt: new Date().setHours(23, 59, 59)
            }
        });
        
        res.json({
            totalPatients,
            totalAppointments,
            todayAppointments
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
