"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom";
import "./App.css"

function App() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")

  const handleSubmit = async (e) => {
  e.preventDefault();

  const payload = {
    email,
    password,
    nickname,
  };

  try {
    const response = await fetch("http://localhost:8080/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Signup failed");
    }

    const data = await response.json();
    console.log("✅ Signup successful:", data);
    alert("회원가입 성공!");
    navigate("/login");

  } catch (error) {
    console.error("❌ Error during signup:", error);
    alert("회원가입 실패: 서버 에러 또는 잘못된 입력입니다.");
  }
  }

  return (
    <div className="app-container">
      <div className="form-container">
        <div className="logo-container">
          <img src="/images/devchat-logo.png" alt="DevChat Logo" className="logo-image" />
        </div>

        <h1 className="heading">Let's Start!</h1>

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

          <div className="form-group">
            <label htmlFor="nickname">Username</label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="사용할 닉네임을 입력해주세요"
              required
            />
          </div>

          <button type="submit" className="signup-button">
            Sign Up
          </button>
        </form>
      </div>

      <div className="background-container">
        <img src="/images/signup-background.png" alt="Background" className="background-image" />
      </div>
    </div>
  )
}

export default App
