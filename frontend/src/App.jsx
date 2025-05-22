import React from 'react';
import ChatRoom from './pages/ChatRoom';
import Home from './pages/Home'
import BlankRoom from './pages/BlankRoom'
import Login from "./pages/login-form"
import Signup from "./pages/signup"
import MyPage from "./pages/profile"
import EditProfilePage from "./pages/editprofile"
import OAuthRedirectHandler from './components/common/OAuthRedirectHandler';
import RedirectToBackend from './components/common/RedirectToBackend';
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
        <Route path="/myprofile" element={<MyPage />} />
        <Route path="/myprofile/edit" element={<EditProfilePage />} />
        <Route path="/oauth/success" element={<OAuthRedirectHandler />} />
        <Route path="/login/oauth2/code/github" element={<RedirectToBackend />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
