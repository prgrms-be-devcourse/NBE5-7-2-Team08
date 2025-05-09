package project.backend.domain.chat.chatroom.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.NoArgsConstructor;
import project.backend.domain.member.entity.Member;

@Entity
@NoArgsConstructor
@Getter
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

}
