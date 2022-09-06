import React from 'react';
import { Navigate,  Routes, Route, BrowserRouter as Router, } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';

import Home from './Home'
import Health from './Health';

function App() {


  return (
    <Router>
    <Routes>
        <Route path="/health" element={<Health />}  />
      <Route path="/home" element={<Home />} />
      <Route path="/" element={<Navigate replace to="/home" />} />
    </Routes>
  </Router>
  )

}

export default App;
