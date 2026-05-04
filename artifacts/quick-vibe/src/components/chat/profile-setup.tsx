import { useQueryClient } from "@tanstack/react-query";
import { useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const profileSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be at most 20 characters").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileSetup({ onComplete }: { onComplete: () => void }) {
  const queryClient = useQueryClient();
  const updateMe = useUpdateMe();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: "" },
  });

  const onSubmit = (data: ProfileFormValues) => {
    updateMe.mutate(
      { data },
      {
        onSuccess: (user) => {
          queryClient.setQueryData(getGetMeQueryKey(), user);
          onComplete();
        },
        onError: () => {
          form.setError("username", { type: "manual", message: "Username might be taken or an error occurred." });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
        <Card className="border-border/50 shadow-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Welcome to Quick Vibe</CardTitle>
            <CardDescription>Choose a username so people can find you.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl><Input placeholder="e.g. johndoe" {...field} data-testid="input-username" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={updateMe.isPending} data-testid="button-submit-profile">
                  {updateMe.isPending ? "Saving..." : "Get Started"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
