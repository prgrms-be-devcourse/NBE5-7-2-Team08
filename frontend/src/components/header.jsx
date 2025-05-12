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
        const response = await fetch("https://api.example.com/user/profile-image")

        if (!response.ok) {
          throw new Error("Failed to fetch profile image")
        }

        const data = await response.json()
        setProfileImage(data.imageUrl)
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
            <img src="/images/devchat-logo.png" alt="DevChat Logo" className="logo-image" />     
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
              src={profileImage || "https://via.placeholder.com/32"}
              alt="User profile"
              className="profile-image"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = "https://via.placeholder.com/32"
              }}
            />
          )}
          <span className="logout-text">Log Out</span>
        </div>
      </div>
    </header>
  )
}
