package project.backend.domain.chat.chatroom.entity;

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
import lombok.Getter;
import lombok.NoArgsConstructor;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.member.entity.Member;

@Entity
@NoArgsConstructor
@Getter
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_id")
    private Long id;

    private String name;

    private LocalDateTime created_at = LocalDateTime.now();

    private String repository_url;

    @OneToOne
    @JoinColumn(name = "owner_id")
    private Member owner;

    @OneToMany(mappedBy = "chatRoom")
    private List<ChatMessage> messages = new ArrayList<>();

    @OneToMany(mappedBy = "chatRoom")
    private List<ChatParticipant> participants = new ArrayList<>();

}
