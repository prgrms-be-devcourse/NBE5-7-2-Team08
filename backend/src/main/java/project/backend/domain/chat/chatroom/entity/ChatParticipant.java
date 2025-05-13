package project.backend.domain.chat.chatroom.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import project.backend.domain.member.entity.Member;

@Getter
@Entity
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatParticipant {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "chat_participant_id")
	private Long id;

	@ManyToOne
	@JoinColumn(name = "member_id")
	private Member participant;

	@ManyToOne
	@JoinColumn(name = "room_id")
	private ChatRoom chatRoom;

	@Builder
	public ChatParticipant(Long id, Member participant, ChatRoom chatRoom) {
		this.id = id;
		this.participant = participant;
		this.chatRoom = chatRoom;
	}
}

