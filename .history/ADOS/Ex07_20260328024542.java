public class Ex07 {
    public static void main(String[] args) {
        int n1 = 15;
        int n2 = 8;
        int n3 = 15;

        if (n1 == n2 || n1 == n3 || n2 == n3) {
            System.out.println("Atenção: Há números iguais na entrada.");
        } else {
            System.out.println("Todos os números são diferentes entre si.");
        }

        // Encontrando o MAIOR
        if (n1 >= n2 && n1 >= n3) {
            System.out.println("Maior número: " + n1);
        } else if (n2 >= n1 && n2 >= n3) {
            System.out.println("Maior número: " + n2);
        } else {
            System.out.println("Maior número: " + n3);
        }

        // Encontrando o MENOR
        if (n1 <= n2 && n1 <= n3) {
            System.out.println("Menor número: " + n1);
        } else if (n2 <= n1 && n2 <= n3) {
            System.out.println("Menor número: " + n2);
        } else {
            System.out.println("Menor número: " + n3);
        }
    }
}