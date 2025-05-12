package project.backend.domain.chat.chatroom.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.member.entity.Member;

@Getter
@Entity
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatRoom {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "room_id")
	private Long id;

	@Column(nullable = false)
	private String name;

	private LocalDateTime createdAt = LocalDateTime.now();

	private String repositoryUrl;

	@ManyToOne
	@JoinColumn(name = "owner_id")
	private Member owner;

	@OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<ChatMessage> messages = new ArrayList<>();

	@OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<ChatParticipant> participants = new ArrayList<>();

	@Builder
	public ChatRoom(String name, LocalDateTime createdAt, String repositoryUrl, Member owner,
		List<ChatMessage> messages, List<ChatParticipant> participants) {
		this.name = name;
		this.createdAt = createdAt != null ? createdAt : LocalDateTime.now();
		this.repositoryUrl = repositoryUrl;
		this.owner = owner;
		if (messages != null) {
			this.messages = messages;
		}
		if (participants != null) {
			this.participants = participants;
		}
	}
}
