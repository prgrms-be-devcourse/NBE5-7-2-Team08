package project.backend.domain.chat.chatroom.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.GenericGenerator;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.member.entity.Member;

@Entity
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Getter
@Builder
public class ChatRoom {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "room_id")
	private Long id;

	private String name;

	private LocalDateTime createdAt;

	private String repositoryUrl;

	private String inviteCode;

	@ManyToOne
	@JoinColumn(name = "owner_id")
	private Member owner;

	@OneToMany(mappedBy = "chatRoom")
	private List<ChatMessage> messages = new ArrayList<>();

	@OneToMany(mappedBy = "chatRoom")
	private List<ChatParticipant> participants = new ArrayList<>();

}
