import React from 'react';
import ChatRoom from './pages/ChatRoom';
import Home from './pages/Home'
import BlankRoom from './pages/BlankRoom'
import Login from "./pages/login-form"
import Signup from "./pages/signup"

import { BrowserRouter, Routes, Route } from 'react-router-dom';



function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />}/>
      <Route path="/chat/:roomId" element={<ChatRoom />} />
      <Route path="/blank" element={<BlankRoom />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
    </Routes>
  </BrowserRouter>
  );
}

export default App;
