package project.backend.domain.member.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.imagefile.ImageFile;

@Entity
@Getter
@NoArgsConstructor
public class Member {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "member_id")
	private Long id;

	private String email;

	private String password;

	private String nickname;

	private LocalDateTime joinAt = LocalDateTime.now();

	@OneToMany(mappedBy = "participant")
	private List<ChatParticipant> participants = new ArrayList<>();

	@OneToOne
	@JoinColumn(name = "profile_image_id") // 회원 테이블에 image_id 컬럼 생성
	private ImageFile profileImage;

	@Builder
	public Member(Long id, String email, String password, String nickname, LocalDateTime joinAt) {
		this.id = id;
		this.email = email;
		this.password = password;
		this.nickname = nickname;
		this.joinAt = joinAt;
	}
}
