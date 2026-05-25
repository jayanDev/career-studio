"use client";

import { useChat } from "@ai-sdk/react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";

export function MockInterviewChat({ targetRole }: { targetRole: string }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/ai/career-gps-chat",
    body: {
      context: { targetRole },
    },
    initialMessages: [
      {
        id: "1",
        role: "assistant",
        content: `Hi there! I'm acting as a Hiring Manager for the ${targetRole} position. Tell me a bit about yourself and why you're interested in this role.`,
      },
    ],
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full flex items-center justify-center gap-2 border-teal-200 text-teal-800 hover:bg-teal-50">
          <MessageSquare className="size-4" />
          Mock Interview
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full bg-neutral-50 p-0 border-l">
        <SheetHeader className="p-6 border-b bg-white">
          <SheetTitle>Mock Interview: {targetRole}</SheetTitle>
          <SheetDescription>
            Practice answering questions for this specific role. The AI will act as a tough hiring manager.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                m.role === "user" 
                  ? "bg-teal-700 text-white rounded-br-none" 
                  : "bg-white border text-neutral-800 rounded-bl-none shadow-sm"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border text-neutral-500 rounded-lg rounded-bl-none shadow-sm p-3 text-sm flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce delay-150"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your answer..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="bg-teal-700 hover:bg-teal-800 text-white">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
