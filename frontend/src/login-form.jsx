"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom";
import "./App.css"

function App() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e) => {
  e.preventDefault();

  const params = new URLSearchParams();
  params.append("email",email);
  params.append("password",password);

  try {
    const response = await fetch("http://localhost:8080/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: params.toString(),
      credentials: "include",
    });


    if (!response.ok) {
      const errorData = await response.json();
      console.error(errorData)
      alert(errorData.message || "로그인 실패");
      return;
    }

    const data = await response.json();
    console.log("Signup successful:", data);
    alert("로그인 성공!");
    navigate("/");

  } catch (error) {
    console.error("네트워크 또는 서버 에러:", error);
    alert("서버에 연결할 수 없습니다.");
  }
}

  return (
    <div className="app-container">
      <div className="form-container">
        <div className="logo-container">
          <a href="/">
            <img src="/images/devchat-logo.png" alt="DevChat Logo" className="logo-image" />
          </a>
        </div>

        <h1 className="heading">Welcome Back!</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력해주세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해주세요"
              required
            />
          </div>

          <button type="submit" className="signup-button">
            Login
          </button>
        </form>

        <div className="signup-link">
          <span>계정이 아직 없으신가요?</span>
          <a href="/signup">회원가입</a>
        </div>
      </div>

      <div className="background-container">
        <img src="/images/signup-background.png" alt="Background" className="background-image" />
      </div>
    </div>
  )
}

export default App
