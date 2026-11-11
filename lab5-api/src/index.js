require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API iniciada en puerto ${PORT}; documentación en /api-docs`));
