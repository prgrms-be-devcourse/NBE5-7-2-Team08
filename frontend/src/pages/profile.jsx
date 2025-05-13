import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/SideBar';
import Header from '../components/header';
import styles from "../profile-page.module.css";

const ProfilePage = () => {
  const { memberId } = useParams();
  const [userDetails, setUserDetails] = useState(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await fetch(`http://localhost:8080/user/details/${memberId}`, {
          method: "GET",
          credentials: "include"
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(errorData);
          alert(errorData.message || "프로필 조회 실패");
          return;
        }

        const data = await response.json();
        setUserDetails(data);
      } catch (error) {
        console.error("네트워크 또는 서버 에러:", error);
        alert("서버에 연결할 수 없습니다.");
      }
    };

    fetchUserDetails();
  }, [memberId]);

  // 데이터 로딩 중
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
            {/* 왼쪽: 프로필 정보 */}
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

                <button className={styles["edit-profile-button"]}>
                  Edit Profile
                </button>
              </div>
            </div>

            {/* 오른쪽: 방 목록 (나중에 구현 예정) */}
            <div className={styles["rooms-section"]}>
              <h2 className={styles["rooms-title"]}>Rooms I Created</h2>
              <div className={styles["rooms-list"]}>
                <p>Coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
