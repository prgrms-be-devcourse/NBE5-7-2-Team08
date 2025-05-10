package project.backend.domain.chat.chatmessage.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;

@Entity
@Getter
@NoArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "message_id")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "sender_id")
    private ChatParticipant sender;

    @ManyToOne
    @JoinColumn(name = "room_id")
    private ChatRoom chatRoom;

    private String content;

    private LocalDateTime sendAt = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    private MessageType type = MessageType.TEXT;

    @Builder
    public ChatMessage(MessageType type, String content, ChatRoom chatRoom,
        ChatParticipant sender) {
        this.type = type;
        this.content = content;
        this.chatRoom = chatRoom;
        this.sender = sender;
    }
}
