"use client"

import { useState, useEffect } from "react"
import "./header.css"

export function Header() {
  const [profileImage, setProfileImage] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch profile image from backend server
    const fetchProfileImage = async () => {
      try {
        setIsLoading(true)
        // Replace with your actual API endpoint
        const response = await fetch("http://localhost:8080/user/details" ,{
          method: "GET",
          credentials: "include"
        });
        

        if (!response.ok) {
          throw new Error("Failed to fetch profile image")
        }

        const data = await response.json()
        setProfileImage(data.profileImg)
        setIsLoading(false)
      } catch (err) {
        console.error("Error fetching profile image:", err)
        setError(err.message)
        setIsLoading(false)
      }
    }

    fetchProfileImage()
  }, [])

  return (
    <header className="header">
      <div className="container">
          <a href="/">
            <img src="/images/devchat-logo.png" alt="DevChat Logo" className="header-logo-image" />     
          </a>
        <div className="profile-container">
          {isLoading ? (
            <div className="profile-image-loading"></div>
          ) : error ? (
            <div className="profile-image-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          ) : (
            <img 
              src={profileImage}
              alt="User profile"
              className="profile-image"
            />
          )}
          <button
            className="logout-text"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              fontWeight: 500
            }}
            onClick={async () => {
              try {
                const response = await fetch("http://localhost:8080/logout", {
                  method: "POST",
                  credentials: "include" // ✅ 세션 쿠키 포함 (JSESSIONID)
                });

                if (response.ok) {
                  alert("로그아웃 되었습니다.");
                  window.location.href = "/login"; // 또는 원하는 페이지로 이동
                } else {
                  alert("로그아웃 실패");
                }
              } catch (error) {
                console.error("로그아웃 요청 실패:", error);
                alert("서버 오류로 로그아웃 실패");
              }
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header;
