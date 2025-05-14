"use client"

import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import Sidebar from "../components/SideBar"
import Header from "../components/header"
import { Edit2 } from "lucide-react"
import styles from "../edit-profile-page.module.css"

const EditProfilePage = () => {
  const navigate = useNavigate()
  const [userDetails, setUserDetails] = useState(null)
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const alertShownRef = useRef(false)
  const stopRequestRef = useRef(false)

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await fetch("http://localhost:8080/user/details", {
          method: "GET",
          credentials: "include",
        })

        if (!response.ok) {
          const errorData = await response.json()
          const status = response.status

          if (!alertShownRef.current) {
            alertShownRef.current = true
            alert(errorData.message || "사용자 정보 조회 실패")
            stopRequestRef.current = true

            if (status === 401) {
              navigate("/login")
            }
          }
          return
        }

        const data = await response.json()
        setUserDetails(data)
        setNickname(data.nickname) // 기존 닉네임 기본값으로 설정
      } catch (error) {
        if (!alertShownRef.current) {
          alertShownRef.current = true
          alert("서버 연결 실패")
          stopRequestRef.current = true
        }
      }
    }

    fetchUserDetails()
  }, [navigate])

  const handleSave = async () => {
    if (password !== confirmPassword) {
      alert("비밀번호가 일치하지 않습니다.")
      return
    }

    try {
      const response = await fetch("http://localhost:8080/user/update", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname,
          password,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.message || "업데이트 실패")
        return
      }

      alert("프로필이 성공적으로 수정되었습니다!")
      navigate("/myprofile")
    } catch (error) {
      alert("요청 실패")
    }
  }

  if (!userDetails) {
    return <div className={styles["loading"]}>Loading...</div>
  }

  return (
    <div className={styles["app-container"]}>
      <Header />
      <div className={styles["content-wrapper"]}>
        <Sidebar />

        <div className={styles["main-content"]}>
          <h1 className={styles["page-title"]}>Edit Profile</h1>
          <div className={styles["edit-container"]}>
            <div className={styles["profile-picture-section"]}>
              <div className={styles["profile-picture"]}>
                <img
                  src={`http://localhost:8080${userDetails.profileImg}`}
                  alt="Profile"
                  className={styles["profile-image"]}
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = "/placeholder.svg"
                  }}
                />
                <div className={styles["edit-icon"]}>
                  <Edit2 size={20} />
                </div>
              </div>
            </div>

            <div className={styles["form-section"]}>
              <div className={styles["form-group"]}>
                <label>Nickname</label>
                <input
                  type="text"
                  placeholder="닉네임 입력"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              <div className={styles["form-row"]}>
                <div className={styles["form-group"]}>
                  <label>New Password</label>
                  <input
                    type="password"
                    placeholder="새 비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className={styles["form-group"]}>
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="비밀번호 확인"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles["button-wrapper"]}>
                <button className={styles["save-button"]} onClick={handleSave}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditProfilePage
