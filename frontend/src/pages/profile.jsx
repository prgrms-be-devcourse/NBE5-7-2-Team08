import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/SideBar';
import Header from '../components/header';
import styles from "../profile-page.module.css";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState(null);
  const [userRooms, setUserRooms] = useState([]);
  const alertShownRef = useRef(false); // alert 여부 기억
  const stopRequestRef = useRef(false); // 전체 중단 플래그

  useEffect(() => {
    if (stopRequestRef.current) return; // ❗ 예외 이후 모든 요청 차단

    const fetchUserDetails = async () => {
      try {
        const response = await fetch("http://localhost:8080/user/details", {
          method: "GET",
          credentials: "include"
        });

        if (!response.ok) {
          const errorData = await response.json();
          const status = response.status;

          if (!alertShownRef.current) {
            alertShownRef.current = true;
            alert(errorData.message || "사용자 정보 조회 실패");
            stopRequestRef.current = true;

            if (status === 401) {
              navigate('/login');
            }
          }

          return;
        }

        const data = await response.json();
        setUserDetails(data);
      } catch (error) {
        if (!alertShownRef.current) {
          alertShownRef.current = true;
          alert("서버 연결 실패");
          stopRequestRef.current = true;
        }
      }
    };

    fetchUserDetails();
  }, [navigate]);

  useEffect(() => {
    if (!userDetails || stopRequestRef.current) return;


    const fetchUserRooms = async () => {
      if (stopRequestRef.current) return;

      try {
        const response = await fetch(`http://localhost:8080/chat-rooms/mine/${userDetails.id}`, {
          method: "GET",
          credentials: "include"
        });

        if (!response.ok) {
          const errorData = await response.json();

          if (!alertShownRef.current) {
            alertShownRef.current = true;
            alert(errorData.message);
            stopRequestRef.current = true;
            navigate('/login');
          }

          return;
        }

        const data = await response.json();
        setUserRooms(data.content);
      } catch (error) {
        if (!alertShownRef.current) {
          alertShownRef.current = true;
          alert("채팅방 로딩 실패");
          stopRequestRef.current = true;
        }
      }
    };

    fetchUserRooms();
  }, [userDetails ,navigate]);

  

  if (!userDetails) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles["app-container"]}>
      <Header />
      <div className={styles["content-wrapper"]}>
        <Sidebar />

        <div className={styles["main-content"]}>
          <h1 className={styles["page-title"]}>My Profile</h1>

          <div className={styles["profile-container"]}>
            <div className={styles["profile-section"]}>
              <div className={styles["profile-card"]}>
                <div className={styles["profile-image-container"]}>
                  <div className={styles["profile-image-in-page"]}>
                    <img
                      className={styles["profile-image"]}
                      src={`http://localhost:8080${userDetails.profileImg}`}
                      alt="Profile"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                </div>
                <h2 className={styles["profile-name"]}>{userDetails.nickname}</h2>
                <p className={styles["profile-email"]}>{userDetails.email}</p>
                <button className={styles["edit-profile-button"]}>Edit Profile</button>
              </div>
            </div>

            {/* 오른쪽: 채팅방 리스트 */}
            <div className={styles["rooms-section"]}>
              <h2 className={styles["rooms-title"]}>Rooms I Created</h2>
              <div className={styles["rooms-list"]}>
                {userRooms.length > 0 ? (
                  userRooms.map((room) => (
                    <div key={room.id} className={styles["room-item"]}>
                      <div className={styles["room-info"]}>
                        <div className={styles["room-icon"]}>
                          {/* 채팅방 아이콘 */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </div>
                        <div>
                          <h3 className={styles["room-title"]}>{room.roomName}</h3>
                          <div className={styles["room-members"]}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="9" cy="7" r="4"></circle>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            <span>{room.participantCount} members</span>
                          </div>
                        </div>
                      </div>
                      <button className={styles["join-button"]}>Join</button>
                    </div>
                  ))
                ) : (
                  <div className={styles["empty-rooms"]}>
                    <p>No rooms created yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
