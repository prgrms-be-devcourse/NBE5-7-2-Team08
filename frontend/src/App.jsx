import React from 'react';
import ChatRoom from './pages/ChatRoom';
import Home from './pages/Home'
import BlankRoom from './pages/BlankRoom'
import JoinPage from './pages/JoinPage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />}/>
      <Route path="/join" element={<JoinPage />} />
      <Route path="/chat/:roomId" element={<ChatRoom />} />
      <Route path="/blank" element={<BlankRoom />} />
    </Routes>
  </BrowserRouter>
  );
}

export default App;
