package project.backend.domain.chat.chatmessage.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ChatMessageSearchRequest {

	private String keyword;

	private int page = 0;

	private int pageSize = 20;

}

