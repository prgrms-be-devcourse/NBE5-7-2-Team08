import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginForm from "./login-form";
import Signup from "./signup";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/mypage" element={<div>Welcome to Mypage</div>} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
