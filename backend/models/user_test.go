package models

import "testing"

func TestUser_SetPassword_and_CheckPassword(t *testing.T) {
	var u User
	if err := u.SetPassword("secret123"); err != nil {
		t.Fatal(err)
	}
	if !u.CheckPassword("secret123") {
		t.Fatal("expected password to match")
	}
	if u.CheckPassword("wrong") {
		t.Fatal("expected wrong password to fail")
	}
}

func TestUser_BeforeCreate_assignsID(t *testing.T) {
	u := &User{Username: "tester", Role: "user"}
	if err := u.BeforeCreate(nil); err != nil {
		t.Fatal(err)
	}
	if u.ID.String() == "00000000-0000-0000-0000-000000000000" {
		t.Fatal("expected generated UUID")
	}
}
