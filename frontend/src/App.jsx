import React from 'react';
import ChatRoom from './pages/ChatRoom';
import Home from './pages/Home'
import BlankRoom from './pages/BlankRoom'
import Login from "./pages/login-form"
import Signup from "./pages/signup"
<<<<<<< HEAD
=======
import JoinPage from './pages/JoinPage';
import MyPage from "./pages/profile"
import EditProfilePage from "./pages/editprofile"

>>>>>>> 6d0e88374524ec70cd0c060c30e04506ef352fd8
import { BrowserRouter, Routes, Route } from 'react-router-dom';



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />}/>
        <Route path="/chat/:roomId/:inviteCode" element={<ChatRoom />} />
        <Route path="/blank" element={<BlankRoom />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
<<<<<<< HEAD
=======
        <Route path="/myprofile" element={<MyPage />} />
        <Route path="/myprofile/edit" element={<EditProfilePage />} />
        <Route path="/join" element={<JoinPage />} />
>>>>>>> 6d0e88374524ec70cd0c060c30e04506ef352fd8
      </Routes>
    </BrowserRouter>
  );
}

export default App;
