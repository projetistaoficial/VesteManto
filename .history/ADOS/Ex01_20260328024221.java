public class Ex01 {
    public static void main(String[] args) {
        String usuarioDigitado = "admin";
        String senhaDigitada = "1234";

        if (usuarioDigitado.equals("admin") && senhaDigitada.equals("1234")) {
            System.out.println("Acesso concedido");
        } else if (!usuarioDigitado.equals("admin")) {
            System.out.println("Usuário incorreto");
        } else {
            // Se chegou aqui, o usuário está certo, mas a senha está errada
            System.out.println("Senha incorreta");
        }
    }
}