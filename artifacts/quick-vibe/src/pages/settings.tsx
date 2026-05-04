import { useState, useRef } from "react";
import { Link } from "wouter";
import { useGetMe, getGetMeQueryKey, useUpdateMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, Loader2, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChatBackground } from "@/hooks/use-chat-background";
import BackgroundPicker from "@/components/chat/background-picker";
import { useClerk } from "@clerk/react";

const profileSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be at most 20 characters").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function resizeImageToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const { data: me, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const queryClient = useQueryClient();
  const updateMe = useUpdateMe();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const { bgId, setBackground } = useChatBackground(me?.id);
  const { signOut } = useClerk();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: { username: me?.username || "" },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!me) return <div className="flex h-screen items-center justify-center">Not logged in</div>;

  const displayAvatar = avatarPreview ?? me.avatarUrl ?? undefined;
  const getInitials = () => me.username.charAt(0).toUpperCase();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setAvatarPreview(dataUrl);
      updateMe.mutate({ data: { avatarUrl: dataUrl } }, {
        onSuccess: (user) => { queryClient.setQueryData(getGetMeQueryKey(), user); toast({ title: "Profile picture updated" }); },
        onError: () => { setAvatarPreview(null); toast({ title: "Upload failed", description: "Could not update profile picture.", variant: "destructive" }); },
        onSettled: () => setIsUploadingAvatar(false),
      });
    } catch {
      setIsUploadingAvatar(false);
      toast({ title: "Error", description: "Could not process image.", variant: "destructive" });
    }
    e.target.value = "";
  };

  const onSubmit = (data: ProfileFormValues) => {
    updateMe.mutate({ data }, {
      onSuccess: (user) => { queryClient.setQueryData(getGetMeQueryKey(), user); toast({ title: "Profile updated", description: "Your profile has been successfully updated." }); },
      onError: () => { toast({ title: "Update failed", description: "There was an error updating your profile.", variant: "destructive" }); },
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/chat"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Card className="border-border/50 shadow-sm bg-card/50">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your public profile information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex items-center gap-6">
              <div className="relative group flex-shrink-0">
                <Avatar className="w-24 h-24 border-4 border-background shadow-sm">
                  <AvatarImage src={displayAvatar} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">{getInitials()}</AvatarFallback>
                </Avatar>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar} className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed" data-testid="button-change-avatar">
                  {isUploadingAvatar ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} data-testid="input-avatar-file" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-lg">@{me.username}</h3>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar} className="text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline mt-1">
                  {isUploadingAvatar ? "Uploading..." : "Change profile picture"}
                </button>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl><Input {...field} data-testid="input-username" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateMe.isPending} data-testid="button-save-settings">
                    {updateMe.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm bg-card/50">
          <CardHeader>
            <CardTitle>Chat Background</CardTitle>
            <CardDescription>Choose a background style for your message area. Saved automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <BackgroundPicker currentBgId={bgId} onSelect={setBackground} />
          </CardContent>
        </Card>

        <Card className="border-destructive/20 shadow-sm bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Sign out</CardTitle>
            <CardDescription>Sign out of your account on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => signOut({ redirectUrl: "/" })}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
