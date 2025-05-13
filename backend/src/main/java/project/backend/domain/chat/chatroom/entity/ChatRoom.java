package project.backend.domain.chat.chatroom.entity;


import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.member.entity.Member;


@Entity
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Getter
public class ChatRoom {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "room_id")
	private Long id;

	@Column(nullable = false)
	private String name;

	private LocalDateTime createdAt;

	private String repositoryUrl;

	private String inviteCode;

	@ManyToOne
	@JoinColumn(name = "owner_id")
	private Member owner;

	@OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<ChatMessage> messages = new ArrayList<>();

	@OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<ChatParticipant> participants = new ArrayList<>();

	@Builder
	public ChatRoom(String name, LocalDateTime createdAt, String repositoryUrl,String inviteCode, Member owner,
		List<ChatMessage> messages, List<ChatParticipant> participants) {
		this.name = name;
		this.createdAt = createdAt != null ? createdAt : LocalDateTime.now();
		this.repositoryUrl = repositoryUrl;
		this.inviteCode = inviteCode;
		this.owner = owner;
		if (messages != null) {
			this.messages = messages;
		}
		if (participants != null) {
			this.participants = participants;
		}
	}
}
