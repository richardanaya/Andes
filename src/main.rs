use clap::Parser;
use iced::widget::{button, column, row, scrollable, text, text_input, Column, Scrollable, Space};
use iced::{Alignment, Command, Element};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

#[derive(Serialize, Deserialize)]
struct OllamaResonse {
    model: String,
    created_at: String,
    message: ChatMessage,
    done: bool,
    total_duration: u64,
    load_duration: u64,
    prompt_eval_duration: u64,
    eval_count: u64,
    eval_duration: u64,
}

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    /// Name of the person to greet
    #[arg(short)]
    ollama_url: String,

    #[arg(short)]
    model: String,
}

pub fn main() -> iced::Result {
    iced::run("Andes", Andes::update, Andes::view)
}

struct Andes {
    ollama_url: String,
    model: String,
    chat: Chat,
    context: String,
    input: String,
}

#[derive(Debug, Clone)]
enum Message {
    EditContext(String),
    EditInput(String),
    Send,
    Clear,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone)]
struct Chat {
    messages: Vec<ChatMessage>,
}

static SCROLLABLE: Lazy<scrollable::Id> = Lazy::new(|| scrollable::Id::new("scrollable"));
static INPUT_ID: Lazy<text_input::Id> = Lazy::new(|| text_input::Id::new("user_input"));

const LOGO: &'static [u8] = include_bytes!("andes.png");

impl Default for Andes {
    fn default() -> Self {
        let a: Args = Args::parse();
        Self {
            ollama_url: a.ollama_url,
            model: a.model,
            chat: Chat { messages: vec![] },
            input: String::new(),
            context: String::new(),
        }
    }
}

impl Andes {
    fn update(&mut self, message: Message) -> Command<Message> {
        match message {
            Message::Clear => {
                self.chat.messages.clear();
                self.input.clear();
                Command::none()
            }
            Message::EditContext(context) => {
                self.context = context;
                Command::none()
            }
            Message::EditInput(input) => {
                self.input = input;
                Command::none()
            }
            Message::Send => {
                // add user message to chat history
                self.chat.messages.push(ChatMessage {
                    role: "user".to_string(),
                    content: self.input.clone(),
                });

                // first, add system message using current context, then add all chat history messages that aren't system, then add new user message
                let mut messages = vec![];
                if !self.context.is_empty() {
                    messages.push(ChatMessage {
                        role: "system".to_string(),
                        content: self.context.clone(),
                    });
                }
                for message in self.chat.messages.iter() {
                    if message.role != "system" {
                        messages.push(message.clone());
                    }
                }

                let req = OllamaRequest {
                    model: self.model.clone(),
                    messages,
                    stream: false,
                };
                let body = serde_json::to_string(&req).unwrap();

                let client = reqwest::blocking::Client::new();
                let res = client
                    .post(format!("http://{}/api/chat", self.ollama_url).as_str())
                    .body(body)
                    .send();
                let res = match res {
                    Ok(res) => res.text(),
                    Err(e) => {
                        println!("{:?}", e);
                        return Command::none();
                    }
                };
                let text = match res {
                    Ok(text) => text,
                    Err(e) => {
                        println!("{:?}", e);
                        return Command::none();
                    }
                };
                let res: OllamaResonse = match serde_json::from_str::<OllamaResonse>(&text) {
                    Ok(res) => res,
                    Err(e) => {
                        println!("{:?}", e);
                        return Command::none();
                    }
                };
                self.chat.messages.push(res.message.clone());
                self.input.clear();

                Command::batch(vec![
                    scrollable::snap_to(SCROLLABLE.clone(), scrollable::RelativeOffset::END),
                    text_input::focus(INPUT_ID.clone()),
                ])
            }
        }
    }

    fn view(&self) -> Element<Message> {
        // lets dynamicall add the chat messages
        let mut messages = self
            .chat
            .messages
            .iter()
            .map(|message| {
                column![
                    text(&message.role).size(16).color([0.2, 0.2, 0.2]),
                    text(&message.content).size(16).color([0.4, 0.4, 0.4]),
                    Space::new(28, 28)
                ]
                .align_items(Alignment::Start)
                .into()
            })
            .collect::<Vec<Element<Message>>>();

        if messages.is_empty() {
            messages.insert(
                0,
                row![column![
                    iced::widget::image::Image::new(iced::widget::image::Handle::from_memory(LOGO))
                        .width(300),
                    text("Andes").size(32)
                ]
                .width(iced::Length::Fill)
                .align_items(Alignment::Center)]
                .padding(20)
                .width(iced::Length::Fill)
                .align_items(Alignment::Center)
                .into(),
            );
        }

        messages.push(
            text_input("Context... ", &self.context)
                .on_input(|s| Message::EditContext(s))
                .into(),
        );
        messages.push(Space::new(20, 20).into());
        messages.push(
            text_input("Message...", &self.input)
                .id(INPUT_ID.clone())
                .on_input(|s| Message::EditInput(s))
                .on_submit(Message::Send)
                .into(),
        );
        messages.push(Space::new(20, 20).into());
        messages.push(
            button("Clear")
                .on_press(Message::Clear)
                .width(iced::Length::Fill)
                .into(),
        );

        // full width
        let ui = Column::from_vec(messages)
            .padding(20)
            .width(iced::Length::Fill)
            .align_items(Alignment::Start);

        // put it in a scrollable container
        Scrollable::new(ui)
            .id(SCROLLABLE.clone())
            .width(iced::Length::Fill)
            .height(iced::Length::Fill)
            .into()
    }
}
